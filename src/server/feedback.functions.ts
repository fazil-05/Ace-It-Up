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
    { id: "f-e1", topic: "percentages", difficulty: "easy", question: "20% of 250 is?", options: ["25", "40", "50", "75"], answer_index: 2, explanation: "20% of 250 = (20/100) * 250 = 50." },
    { id: "f-e2", topic: "averages", difficulty: "easy", question: "What is the average of 10, 20, 30, 40, and 50?", options: ["25", "30", "35", "40"], answer_index: 1, explanation: "Sum = 150. Count = 5. Average = 150/5 = 30." },
    { id: "f-e3", topic: "profit-loss", difficulty: "easy", question: "A pen is bought for $10 and sold for $12. What is the profit percentage?", options: ["10%", "15%", "20%", "25%"], answer_index: 2, explanation: "Profit = $2. Profit % = (2/10) * 100 = 20%." },
    { id: "f-e4", topic: "ratio-proportion", difficulty: "easy", question: "If A:B = 2:3 and B:C = 4:5, what is A:B:C?", options: ["8:12:15", "2:4:5", "6:8:10", "8:10:15"], answer_index: 0, explanation: "Multiply A:B by 4 and B:C by 3 to equate B. (2*4):(3*4) and (4*3):(5*3) = 8:12 and 12:15." },
    { id: "f-e5", topic: "number-series", difficulty: "easy", question: "Complete the series: 2, 4, 8, 16, ?", options: ["20", "24", "32", "64"], answer_index: 2, explanation: "Each number is multiplied by 2. 16 * 2 = 32." },
  ];
  const medium: AptitudeQuestion[] = [
    { id: "f-m1", topic: "speed-time-distance", difficulty: "medium", question: "A train 150m long passes a pole in 15 seconds. What is its speed in km/hr?", options: ["36", "45", "54", "60"], answer_index: 0, explanation: "Speed = 150/15 = 10 m/s. 10 * (18/5) = 36 km/hr." },
    { id: "f-m2", topic: "probability", difficulty: "medium", question: "Two coins are tossed. What is the probability of getting at least one head?", options: ["1/4", "1/2", "3/4", "1"], answer_index: 2, explanation: "Total outcomes: HH, HT, TH, TT (4). Favorable: HH, HT, TH (3). Probability = 3/4." },
    { id: "f-m3", topic: "time-work", difficulty: "medium", question: "A can do a work in 10 days and B in 15 days. How long will they take together?", options: ["5 days", "6 days", "7 days", "8 days"], answer_index: 1, explanation: "1/10 + 1/15 = (3+2)/30 = 5/30 = 1/6. So, 6 days." },
    { id: "f-m4", topic: "simple-interest", difficulty: "medium", question: "Find SI on $5000 at 10% per annum for 2 years.", options: ["$500", "$1000", "$1200", "$1500"], answer_index: 1, explanation: "SI = (P*R*T)/100 = (5000*10*2)/100 = 1000." },
    { id: "f-m5", topic: "lcm-hcf", difficulty: "medium", question: "The HCF of two numbers is 11 and their LCM is 7700. If one number is 275, find the other.", options: ["279", "283", "308", "318"], answer_index: 2, explanation: "Product of numbers = HCF * LCM. Other = (11 * 7700) / 275 = 308." },
  ];
  const hard: AptitudeQuestion[] = [
    { id: "f-h1", topic: "permutations", difficulty: "hard", question: "How many ways can the letters of 'APPLE' be arranged?", options: ["60", "120", "240", "480"], answer_index: 0, explanation: "Total 5 letters, 'P' repeats twice. 5! / 2! = 120 / 2 = 60." },
    { id: "f-h2", topic: "clocks-calendars", difficulty: "hard", question: "What was the day on 15th August 1947?", options: ["Thursday", "Friday", "Saturday", "Sunday"], answer_index: 1, explanation: "Calculation using odd days leads to Friday." },
    { id: "f-h3", topic: "data-interpretation", difficulty: "hard", question: "In a class of 100, 60 like Math, 50 like Science, 30 like both. How many like neither?", options: ["10", "20", "30", "40"], answer_index: 1, explanation: "n(M U S) = n(M) + n(S) - n(M ∩ S) = 60 + 50 - 30 = 80. Neither = 100 - 80 = 20." },
  ];
  
  let pool = easy;
  if (difficulty === "medium") pool = [...easy, ...medium];
  if (difficulty === "hard") pool = [...medium, ...hard];
  
  // Shuffle and slice
  return pool.sort(() => Math.random() - 0.5).slice(0, count);
}
