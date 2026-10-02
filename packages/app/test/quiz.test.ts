import { describe, expect, it } from "vitest";
import { applyAnswers, questionsToReview } from "../src/domain/mistakes";
import { isFinished, quizReducer, score, startQuiz, type QuizAction } from "../src/domain/quiz";
import { question } from "./fixtures";

const run = (actions: QuizAction[]) =>
  actions.reduce(quizReducer, startQuiz([question("q1", ["a"]), question("q2", ["a", "b"])]));

describe("déroulé du quiz", () => {
  it("valider sans choix ne fait rien", () => {
    expect(run([{ type: "check" }]).checked).toBe(false);
  });

  it("note chaque question puis termine", () => {
    const state = run([
      { type: "toggle", choiceId: "q1-a" },
      { type: "check" },
      { type: "next" },
      { type: "toggle", choiceId: "q2-a" },
      { type: "check" },
      { type: "next" },
    ]);
    expect(isFinished(state)).toBe(true);
    expect(score(state)).toEqual({ correct: 1, total: 2, mistakes: ["q2"] });
    expect(state.answers.map((a) => a.choice_ids)).toEqual([["q1-a"], ["q2-a"]]);
  });

  it("pas de modification ni de retour après validation", () => {
    const state = run([{ type: "toggle", choiceId: "q1-b" }, { type: "check" }, { type: "toggle", choiceId: "q1-a" }]);
    expect(state.selected).toEqual(["q1-b"]);
    expect(run([{ type: "toggle", choiceId: "q1-a" }, { type: "next" }]).index).toBe(0);
  });
});

describe("erreurs à revoir (hors ligne)", () => {
  it("une erreur entre en révision, deux réussites d'affilée l'en sortent", () => {
    let m = applyAnswers({}, [{ question_id: "q", choice_ids: [], correct: false }]);
    expect(questionsToReview(m)).toEqual(["q"]);
    m = applyAnswers(m, [{ question_id: "q", choice_ids: [], correct: true }]);
    expect(questionsToReview(m)).toEqual(["q"]);
    m = applyAnswers(m, [{ question_id: "q", choice_ids: [], correct: true }]);
    expect(questionsToReview(m)).toEqual([]);
  });

  it("une bonne réponse sans erreur préalable n'entre pas en révision", () => {
    expect(questionsToReview(applyAnswers({}, [{ question_id: "q", choice_ids: [], correct: true }]))).toEqual([]);
  });
});
