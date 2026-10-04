import { XP_PER_SESSION, XP_PERFECT_BONUS } from "../lib/config";
import type { Question } from "../lib/types";

/** Notation tout ou rien : juste seulement si les choix cochés sont exactement les bonnes réponses. */
export function isAnswerCorrect(question: Question, selected: readonly string[]): boolean {
  const correct = question.choices.filter((c) => c.is_correct).map((c) => c.id);
  const picked = new Set(selected);
  return picked.size === correct.length && correct.every((id) => picked.has(id));
}

/** Coche ou décoche un choix ; une question à réponse unique ne garde que le dernier choix. */
export function toggleChoice(question: Pick<Question, "multiple">, selected: readonly string[], choiceId: string): string[] {
  if (!question.multiple) return [choiceId];
  return selected.includes(choiceId) ? selected.filter((id) => id !== choiceId) : [...selected, choiceId];
}

export function sessionXp(correct: number, total: number): number {
  return XP_PER_SESSION + (total > 0 && correct === total ? XP_PERFECT_BONUS : 0);
}

export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((100 * correct) / total);
}
