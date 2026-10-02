import type { Answer, Question } from "../lib/types";
import { isAnswerCorrect, toggleChoice } from "./grading";

// Déroulé d'un quiz : choisir → valider → correction → question suivante. Pas de retour en arrière.

export type QuizState = {
  questions: Question[];
  index: number;
  selected: string[];
  checked: boolean;
  answers: (Answer & { correct: boolean })[];
};

export type QuizAction = { type: "toggle"; choiceId: string } | { type: "check" } | { type: "next" };

export function startQuiz(questions: Question[]): QuizState {
  return { questions, index: 0, selected: [], checked: false, answers: [] };
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  const question = state.questions[state.index];
  if (!question) return state;
  switch (action.type) {
    case "toggle":
      if (state.checked) return state;
      return { ...state, selected: toggleChoice(question, state.selected, action.choiceId) };
    case "check":
      if (state.checked || state.selected.length === 0) return state;
      return {
        ...state,
        checked: true,
        answers: [
          ...state.answers,
          { question_id: question.id, choice_ids: state.selected, correct: isAnswerCorrect(question, state.selected) },
        ],
      };
    case "next":
      if (!state.checked) return state;
      return { ...state, index: state.index + 1, selected: [], checked: false };
  }
}

export function isFinished(state: QuizState): boolean {
  return state.index >= state.questions.length;
}

export function lastAnswerCorrect(state: QuizState): boolean {
  return state.answers[state.answers.length - 1]?.correct ?? false;
}

export function score(state: QuizState): { correct: number; total: number; mistakes: string[] } {
  return {
    correct: state.answers.filter((a) => a.correct).length,
    total: state.answers.length,
    mistakes: state.answers.filter((a) => !a.correct).map((a) => a.question_id),
  };
}
