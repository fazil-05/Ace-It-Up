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
    { id: "e1", topic: "percentages", difficulty: "easy", question: "20% of 250 is?", options: ["25", "40", "50", "75"], answer_index: 2, explanation: "20% of 250 = (20/100) * 250 = 50." },
    { id: "e2", topic: "averages", difficulty: "easy", question: "Average of 10, 20, 30, 40, 50?", options: ["25", "30", "35", "40"], answer_index: 1, explanation: "Sum = 150. Count = 5. 150/5 = 30." },
    { id: "e3", topic: "profit-loss", difficulty: "easy", question: "Buy at $10, sell at $12. Profit %?", options: ["10%", "15%", "20%", "25%"], answer_index: 2, explanation: "Profit = $2. (2/10) * 100 = 20%." },
    { id: "e4", topic: "ratio-proportion", difficulty: "easy", question: "If A:B = 2:3 and B:C = 4:5, what is A:B:C?", options: ["8:12:15", "2:4:5", "6:8:10", "8:10:15"], answer_index: 0, explanation: "Multiply to equate B: 8:12 and 12:15." },
    { id: "e5", topic: "number-series", difficulty: "easy", question: "Series: 2, 4, 8, 16, ?", options: ["20", "24", "32", "64"], answer_index: 2, explanation: "Multiply by 2. 16 * 2 = 32." },
    { id: "e6", topic: "percentages", difficulty: "easy", question: "Convert 0.05 into percentage.", options: ["0.5%", "5%", "50%", "0.05%"], answer_index: 1, explanation: "0.05 * 100 = 5%." },
    { id: "e7", topic: "averages", difficulty: "easy", question: "Average of first five prime numbers?", options: ["5.2", "5.6", "6.2", "6.6"], answer_index: 1, explanation: "Primes: 2,3,5,7,11. Sum=28. 28/5 = 5.6." },
    { id: "e8", topic: "profit-loss", difficulty: "easy", question: "A man buys a cycle for $1400 and sells it at a loss of 15%. Selling price?", options: ["$1090", "$1160", "$1190", "$1202"], answer_index: 2, explanation: "SP = 85% of 1400 = 1190." },
  ];
  const medium: AptitudeQuestion[] = [
    { id: "m1", topic: "speed-time-distance", difficulty: "medium", question: "A train 150m long passes a pole in 15s. Speed in km/hr?", options: ["36", "45", "54", "60"], answer_index: 0, explanation: "10 m/s * (18/5) = 36 km/hr." },
    { id: "m2", topic: "probability", difficulty: "medium", question: "Two coins tossed. Prob of at least one head?", options: ["1/4", "1/2", "3/4", "1"], answer_index: 2, explanation: "HH, HT, TH, TT. Prob = 3/4." },
    { id: "m3", topic: "time-work", difficulty: "medium", question: "A does work in 10d, B in 15d. Together?", options: ["5 days", "6 days", "7 days", "8 days"], answer_index: 1, explanation: "1/10 + 1/15 = 5/30 = 1/6. So 6 days." },
    { id: "m4", topic: "simple-interest", difficulty: "medium", question: "SI on $5000 at 10% for 2 years?", options: ["$500", "$1000", "$1200", "$1500"], answer_index: 1, explanation: "(5000*10*2)/100 = 1000." },
    { id: "m5", topic: "lcm-hcf", difficulty: "medium", question: "HCF of 11, LCM 7700. One num 275, other?", options: ["279", "283", "308", "318"], answer_index: 2, explanation: "(11 * 7700) / 275 = 308." },
    { id: "m6", topic: "speed-time-distance", difficulty: "medium", question: "A car travels 300km in 5 hours. How much in 8 hours at same speed?", options: ["420km", "450km", "480km", "500km"], answer_index: 2, explanation: "Speed = 60km/h. 60 * 8 = 480km." },
    { id: "m7", topic: "time-work", difficulty: "medium", question: "12 men can finish a project in 20 days. 15 men?", options: ["14 days", "16 days", "18 days", "20 days"], answer_index: 1, explanation: "Total work = 12 * 20 = 240 man-days. 240 / 15 = 16 days." },
  ];
  const hard: AptitudeQuestion[] = [
    { id: "h1", topic: "permutations", difficulty: "hard", question: "Ways to arrange letters of 'APPLE'?", options: ["60", "120", "240", "480"], answer_index: 0, explanation: "5! / 2! = 60." },
    { id: "h2", topic: "clocks-calendars", difficulty: "hard", question: "Day on 15th August 1947?", options: ["Thursday", "Friday", "Saturday", "Sunday"], answer_index: 1, explanation: "Calculation leads to Friday." },
    { id: "h3", topic: "data-interpretation", difficulty: "hard", question: "In class of 100, 60 like Math, 50 Science, 30 both. Neither?", options: ["10", "20", "30", "40"], answer_index: 1, explanation: "100 - (60+50-30) = 20." },
    { id: "h4", topic: "probability", difficulty: "hard", question: "From deck of cards, prob of picking a Red Queen?", options: ["1/13", "1/26", "1/52", "2/13"], answer_index: 1, explanation: "2 Red Queens / 52 cards = 1/26." },
    { id: "h5", topic: "compound-interest", difficulty: "hard", question: "CI on $1000 at 10% for 2 years compounded annually?", options: ["$200", "$210", "$220", "$240"], answer_index: 1, explanation: "1000 * (1.1)^2 = 1210. CI = 210." },
  ];
  
  let pool = [...easy, ...medium, ...hard];
  if (difficulty === "easy") pool = easy;
  else if (difficulty === "medium") pool = [...easy, ...medium];
  
  // High-quality shuffle
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
