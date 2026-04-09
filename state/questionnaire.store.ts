"use client";

import { create } from "zustand";
import type { Answer, AnswerValue } from "@/types/expediente";

/**
 * Per-file questionnaire answers.
 * Key: absolute file path.
 * Value: map of questionId → Answer.
 */
interface QuestionnaireState {
  /** answers[filePath][questionId] = Answer */
  answers: Record<string, Record<string, Answer>>;

  setAnswer: (filePath: string, questionId: string, value: AnswerValue) => void;
  getAnswers: (filePath: string) => Record<string, Answer>;
  getProgress: (filePath: string, totalQuestions: number) => {
    answered: number;
    yes: number;
    no: number;
  };
  clearFile: (filePath: string) => void;
}

export const useQuestionnaireStore = create<QuestionnaireState>((set, get) => ({
  answers: {},

  setAnswer: (filePath, questionId, value) => {
    set((s) => ({
      answers: {
        ...s.answers,
        [filePath]: {
          ...s.answers[filePath],
          [questionId]: { questionId, value } satisfies Answer,
        },
      },
    }));
  },

  getAnswers: (filePath) => get().answers[filePath] ?? {},

  getProgress: (filePath, totalQuestions) => {
    const fileAnswers = get().answers[filePath] ?? {};
    const vals = Object.values(fileAnswers);
    return {
      answered: vals.filter((a) => a.value !== null).length,
      yes: vals.filter((a) => a.value === "yes").length,
      no: vals.filter((a) => a.value === "no").length,
    };
  },

  clearFile: (filePath) => {
    set((s) => {
      const next = { ...s.answers };
      delete next[filePath];
      return { answers: next };
    });
  },
}));
