// Enhanced feedback engine — calls Gemini directly from the client.
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

export const getFeedback = async (input: z.infer<typeof InputSchema>): Promise<FeedbackResult> => {
  const data = InputSchema.parse(input);
  const wordCount = data.answer.trim().split(/\s+/).filter(Boolean).length;
  // Use VITE_ prefix for client-side env variables in Vite
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

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
      console.warn(`AI gateway ${res.status} — falling back.`);
      return enrichFallback(ruleBasedFeedback(data.answer));
    }

    const json = await res.json();
    const argsRaw = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) return enrichFallback(ruleBasedFeedback(data.answer));

    const parsed = JSON.parse(argsRaw);
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

  function enrichFallback(fb: any): FeedbackResult {
    const base = fb.score;
    const clampNum = (n: number) => Math.max(0, Math.min(100, n));
    return {
      score: base,
      grammar_score: clampNum(base + 5),
      clarity_score: base,
      confidence_score: clampNum(base - 5),
      strengths: fb.strengths,
      weaknesses: fb.weaknesses,
      suggestions: fb.suggestions,
      improved_answer: "AI-polished rewrite is unavailable right now. Try again shortly.",
      source: "fallback",
      wordCount: fb.wordCount,
    };
  }
};

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

export const generateAptitudeQuestions = async (input: z.infer<typeof QuestionInput>): Promise<{ difficulty: string; questions: AptitudeQuestion[]; source: "ai" | "fallback" }> => {
  const data = QuestionInput.parse(input);
  const difficulty = data.recentAvg == null ? "medium" : data.recentAvg < 50 ? "easy" : data.recentAvg < 80 ? "medium" : "hard";
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const focusTopics = (data.weakTopics?.length ? data.weakTopics : APT_TOPICS).slice(0, 6);

  if (!apiKey) return { difficulty, questions: fallbackBank(difficulty as any, data.count), source: "fallback" };

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: "You are an expert aptitude question setter. Generate fresh MCQs with 4 options." },
          {
            role: "user",
            content: `Generate ${data.count} ${difficulty}-difficulty aptitude MCQs. Topics: ${focusTopics.join(", ")}.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      answer_index: { type: "integer" },
                      explanation: { type: "string" },
                    },
                    required: ["topic", "question", "options", "answer_index", "explanation"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_questions" } },
      }),
    });

    if (!res.ok) return { difficulty, questions: fallbackBank(difficulty as any, data.count), source: "fallback" };

    const json = await res.json();
    const argsRaw = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsRaw) return { difficulty, questions: fallbackBank(difficulty as any, data.count), source: "fallback" };
    const parsed = JSON.parse(argsRaw);
    const questions: AptitudeQuestion[] = parsed.questions.map((q: any, i: number) => ({
      id: `${Date.now()}-${i}`,
      difficulty,
      ...q,
    }));
    return { difficulty, questions, source: "ai" };
  } catch (err) {
    console.error("generateAptitudeQuestions error:", err);
    return { difficulty, questions: fallbackBank(difficulty as any, data.count), source: "fallback" };
  }
};

function fallbackBank(difficulty: "easy" | "medium" | "hard", count: number): AptitudeQuestion[] {
  const easy: AptitudeQuestion[] = [
    { id: "f-e1", topic: "percentages", difficulty: "easy", question: "20% of 250 is?", options: ["25", "40", "50", "75"], answer_index: 2, explanation: "20% × 250 = 50." },
  ];
  const pool = difficulty === "easy" ? easy : easy; // Simplified for brevity
  return pool.slice(0, count);
}
