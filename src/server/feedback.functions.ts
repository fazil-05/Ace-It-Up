// Enhanced server feedback engine — calls Lovable AI Gateway with structured tool-calling
// returning grammar/clarity/confidence/improved_answer. Falls back to rule-based on errors.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ruleBasedFeedback } from "./feedback.server";

const InputSchema = z.object({
  module: z.enum(["gd", "communication", "interview"]),
  prompt: z.string().min(1).max(500),
  answer: z.string().min(1).max(5000),
});

export type FeedbackResult = {
  score: number;
  grammar_score: number;
  clarity_score: number;
  confidence_score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  improved_answer: string;
  source: "ai" | "fallback";
  wordCount: number;
};

const SYSTEM_PROMPTS: Record<string, string> = {
  gd: "You are an expert placement coach evaluating a student's response in a Group Discussion. Judge structure, clarity, reasoning, language, and confidence.",
  communication: "You are a communication coach evaluating a student's spoken-style response. Judge clarity, grammar, fluency, and confidence.",
  interview: "You are a senior interviewer evaluating a candidate's answer. Judge structure (STAR for behavioral, logical reasoning for technical), depth, language, and confidence.",
};

export const getFeedback = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }): Promise<FeedbackResult> => {
    const wordCount = data.answer.trim().split(/\s+/).filter(Boolean).length;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const fb = ruleBasedFeedback(data.answer);
      return enrichFallback(fb);
    }

    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPTS[data.module] },
            {
              role: "user",
              content: `Prompt/Question: ${data.prompt}\n\nCandidate's answer:\n"""${data.answer}"""\n\nEvaluate it on multiple dimensions and produce an improved version of the answer (~120-180 words).`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "submit_evaluation",
                description: "Return a structured multi-dimensional evaluation.",
                parameters: {
                  type: "object",
                  properties: {
                    score: { type: "integer", minimum: 0, maximum: 100, description: "Overall score 0-100." },
                    grammar_score: { type: "integer", minimum: 0, maximum: 100, description: "Grammar correctness 0-100." },
                    clarity_score: { type: "integer", minimum: 0, maximum: 100, description: "Clarity & structure 0-100." },
                    confidence_score: { type: "integer", minimum: 0, maximum: 100, description: "Perceived confidence/assertiveness 0-100." },
                    strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
                    weaknesses: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
                    suggestions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                    improved_answer: { type: "string", description: "A polished rewrite of the candidate's answer (120-180 words)." },
                  },
                  required: ["score", "grammar_score", "clarity_score", "confidence_score", "strengths", "weaknesses", "suggestions", "improved_answer"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "submit_evaluation" } },
        }),
      });

      if (!res.ok) {
        if (res.status === 429 || res.status === 402) {
          console.warn(`AI gateway ${res.status} — falling back.`);
          return enrichFallback(ruleBasedFeedback(data.answer));
        }
        console.error("AI gateway error:", res.status, await res.text());
        return enrichFallback(ruleBasedFeedback(data.answer));
      }

      const json = await res.json();
      const argsRaw = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) return enrichFallback(ruleBasedFeedback(data.answer));

      const parsed = JSON.parse(argsRaw) as {
        score: number;
        grammar_score: number;
        clarity_score: number;
        confidence_score: number;
        strengths: string[];
        weaknesses: string[];
        suggestions: string[];
        improved_answer: string;
      };
      const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
      return {
        score: clamp(parsed.score),
        grammar_score: clamp(parsed.grammar_score),
        clarity_score: clamp(parsed.clarity_score),
        confidence_score: clamp(parsed.confidence_score),
        strengths: parsed.strengths.slice(0, 4),
        weaknesses: parsed.weaknesses.slice(0, 4),
        suggestions: parsed.suggestions.slice(0, 4),
        improved_answer: String(parsed.improved_answer || "").slice(0, 1500),
        source: "ai",
        wordCount,
      };
    } catch (err) {
      console.error("Feedback function error:", err);
      return enrichFallback(ruleBasedFeedback(data.answer));
    }

    function enrichFallback(fb: ReturnType<typeof ruleBasedFeedback>): FeedbackResult {
      // Heuristic sub-scores derived from the same signals.
      const base = fb.score;
      return {
        score: base,
        grammar_score: clampNum(base + 5),
        clarity_score: base,
        confidence_score: clampNum(base - 5),
        strengths: fb.strengths,
        weaknesses: fb.weaknesses,
        suggestions: fb.suggestions,
        improved_answer: "AI-polished rewrite is unavailable right now (rule-based mode). Try again shortly for a model-generated improved answer.",
        source: "fallback",
        wordCount: fb.wordCount,
      };
    }
    function clampNum(n: number) { return Math.max(0, Math.min(100, n)); }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive aptitude question generator
// ─────────────────────────────────────────────────────────────────────────────

const APT_TOPICS = [
  "speed-time-distance",
  "ratio-proportion",
  "percentages",
  "number-series",
  "averages",
  "profit-loss",
  "lcm-hcf",
  "clocks-calendars",
  "permutations",
  "probability",
  "data-interpretation",
];

const QuestionInput = z.object({
  recentAvg: z.number().min(0).max(100).nullable().optional(),
  weakTopics: z.array(z.string()).max(10).optional(),
  count: z.number().int().min(1).max(8).default(5),
});

export type AptitudeQuestion = {
  id: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};

function pickDifficulty(recentAvg: number | null | undefined): "easy" | "medium" | "hard" {
  if (recentAvg == null) return "medium";
  if (recentAvg < 50) return "easy";
  if (recentAvg < 80) return "medium";
  return "hard";
}

export const generateAptitudeQuestions = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => QuestionInput.parse(raw))
  .handler(async ({ data }): Promise<{ difficulty: "easy" | "medium" | "hard"; questions: AptitudeQuestion[]; source: "ai" | "fallback" }> => {
    const difficulty = pickDifficulty(data.recentAvg ?? null);
    const apiKey = process.env.GEMINI_API_KEY;
    const focusTopics = (data.weakTopics?.length ? data.weakTopics : APT_TOPICS).slice(0, 6);

    if (!apiKey) return { difficulty, questions: fallbackBank(difficulty, data.count), source: "fallback" };

    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [
            { role: "system", content: "You are an expert quantitative aptitude question setter for placement preparation in India. Generate fresh, unambiguous MCQs with exactly 4 options and one correct answer." },
            {
              role: "user",
              content: `Generate ${data.count} ${difficulty}-difficulty aptitude MCQs. Spread topics across: ${focusTopics.join(", ")}. Each question must have exactly 4 options and a clear, short explanation.`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_questions",
              description: "Return a batch of MCQ questions.",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string", enum: APT_TOPICS },
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                        answer_index: { type: "integer", minimum: 0, maximum: 3 },
                        explanation: { type: "string" },
                      },
                      required: ["topic", "question", "options", "answer_index", "explanation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_questions" } },
        }),
      });

      if (!res.ok) {
        console.warn(`Aptitude gateway ${res.status} — using fallback bank.`);
        return { difficulty, questions: fallbackBank(difficulty, data.count), source: "fallback" };
      }

      const json = await res.json();
      const argsRaw = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsRaw) return { difficulty, questions: fallbackBank(difficulty, data.count), source: "fallback" };
      const parsed = JSON.parse(argsRaw) as { questions: Omit<AptitudeQuestion, "id" | "difficulty">[] };
      const questions: AptitudeQuestion[] = parsed.questions.slice(0, data.count).map((q, i) => ({
        id: `${Date.now()}-${i}`,
        difficulty,
        topic: q.topic,
        question: q.question,
        options: q.options.slice(0, 4),
        answer_index: Math.max(0, Math.min(3, q.answer_index)),
        explanation: q.explanation,
      }));
      if (!questions.length) return { difficulty, questions: fallbackBank(difficulty, data.count), source: "fallback" };
      return { difficulty, questions, source: "ai" };
    } catch (err) {
      console.error("generateAptitudeQuestions error:", err);
      return { difficulty, questions: fallbackBank(difficulty, data.count), source: "fallback" };
    }
  });

function fallbackBank(difficulty: "easy" | "medium" | "hard", count: number): AptitudeQuestion[] {
  const easy: AptitudeQuestion[] = [
    { id: "f-e1", topic: "percentages", difficulty: "easy", question: "20% of 250 is?", options: ["25", "40", "50", "75"], answer_index: 2, explanation: "20% × 250 = 50." },
    { id: "f-e2", topic: "averages", difficulty: "easy", question: "Average of 10, 20, 30, 40, 50?", options: ["20", "25", "30", "35"], answer_index: 2, explanation: "150/5 = 30." },
    { id: "f-e3", topic: "speed-time-distance", difficulty: "easy", question: "A train covers 60 km in 1.5 hours. Speed?", options: ["30 km/h", "40 km/h", "45 km/h", "90 km/h"], answer_index: 1, explanation: "60/1.5 = 40 km/h." },
    { id: "f-e4", topic: "lcm-hcf", difficulty: "easy", question: "LCM of 12 and 18?", options: ["24", "36", "48", "72"], answer_index: 1, explanation: "Common multiple = 36." },
  ];
  const medium: AptitudeQuestion[] = [
    { id: "f-m1", topic: "profit-loss", difficulty: "medium", question: "CP=200, SP=250. Profit %?", options: ["20%", "25%", "30%", "50%"], answer_index: 1, explanation: "(50/200)×100 = 25%." },
    { id: "f-m2", topic: "ratio-proportion", difficulty: "medium", question: "A:B=2:3, B:C=4:5. A:C?", options: ["8:15", "2:5", "4:5", "3:5"], answer_index: 0, explanation: "A:B:C = 8:12:15 → A:C = 8:15." },
    { id: "f-m3", topic: "number-series", difficulty: "medium", question: "Next: 2, 6, 12, 20, ?", options: ["28", "30", "32", "26"], answer_index: 1, explanation: "Differences 4,6,8,10 → 30." },
    { id: "f-m4", topic: "clocks-calendars", difficulty: "medium", question: "Angle between hands at 3:15?", options: ["0°", "7.5°", "15°", "30°"], answer_index: 1, explanation: "|30·3 − 5.5·15| = 7.5°." },
  ];
  const hard: AptitudeQuestion[] = [
    { id: "f-h1", topic: "probability", difficulty: "hard", question: "Two fair dice rolled. P(sum=7)?", options: ["1/6", "1/8", "1/9", "1/12"], answer_index: 0, explanation: "6 favorable / 36 = 1/6." },
    { id: "f-h2", topic: "permutations", difficulty: "hard", question: "Arrangements of 'LEVEL'?", options: ["20", "30", "60", "120"], answer_index: 1, explanation: "5!/(2!·2!) = 30." },
    { id: "f-h3", topic: "data-interpretation", difficulty: "hard", question: "If sales grow 20%, then drop 25%, net change?", options: ["−10%", "−5%", "0%", "+5%"], answer_index: 0, explanation: "1.2 × 0.75 = 0.9 → −10%." },
    { id: "f-h4", topic: "speed-time-distance", difficulty: "hard", question: "Boat: 10 km/h still water, stream 2 km/h. 24 km downstream + back time?", options: ["4 h", "5 h", "6 h", "7 h"], answer_index: 1, explanation: "24/12 + 24/8 = 2 + 3 = 5 h." },
  ];
  const pool = difficulty === "easy" ? easy : difficulty === "hard" ? hard : medium;
  return pool.slice(0, count);
}
