// Feedback service — calls server functions.
import { getFeedback, generateAptitudeQuestions, type AptitudeQuestion } from "@/server/feedback.functions";

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

export const feedbackService = {
  async analyze(input: { module: "gd" | "communication" | "interview"; prompt: string; answer: string }): Promise<FeedbackResult> {
    return await getFeedback(input);
  },
  async getAdaptiveQuestions(input: { recentAvg: number | null; weakTopics?: string[]; count?: number }) {
    return await generateAptitudeQuestions({
      recentAvg: input.recentAvg,
      weakTopics: input.weakTopics,
      count: input.count ?? 5,
    });
  },
};

export type { AptitudeQuestion };
