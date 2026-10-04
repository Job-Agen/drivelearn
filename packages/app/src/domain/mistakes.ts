import type { Answer } from "../lib/types";

// Suivi local des erreurs, pour réviser hors ligne. Même règle que le serveur :
// une question sort de la révision après deux bonnes réponses d'affilée.

export type Mastery = Record<string, { streak: number; review: boolean }>;

export function applyAnswers(mastery: Mastery, answers: (Answer & { correct: boolean })[]): Mastery {
  const next = { ...mastery };
  for (const a of answers) {
    const prev = next[a.question_id] ?? { streak: 0, review: false };
    next[a.question_id] = a.correct
      ? { streak: prev.streak + 1, review: prev.review && prev.streak + 1 < 2 }
      : { streak: 0, review: true };
  }
  return next;
}

export function questionsToReview(mastery: Mastery): string[] {
  return Object.entries(mastery)
    .filter(([, m]) => m.review)
    .map(([id]) => id);
}
