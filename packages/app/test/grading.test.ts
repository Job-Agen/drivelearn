import { describe, expect, it } from "vitest";
import { isAnswerCorrect, percent, sessionXp, toggleChoice } from "../src/domain/grading";
import { question } from "./fixtures";

describe("notation tout ou rien", () => {
  const multi = question("q", ["a", "c"]);
  it("juste seulement si exactement les bonnes réponses", () => {
    expect(isAnswerCorrect(multi, ["q-a", "q-c"])).toBe(true);
    expect(isAnswerCorrect(multi, ["q-c", "q-a"])).toBe(true);
    expect(isAnswerCorrect(multi, ["q-a"])).toBe(false);
    expect(isAnswerCorrect(multi, ["q-a", "q-b", "q-c"])).toBe(false);
    expect(isAnswerCorrect(multi, [])).toBe(false);
  });

  it("réponse unique : un clic remplace le choix", () => {
    const single = question("s", ["b"]);
    expect(toggleChoice(single, ["s-a"], "s-b")).toEqual(["s-b"]);
  });

  it("réponses multiples : un clic coche ou décoche", () => {
    expect(toggleChoice(multi, ["q-a"], "q-c")).toEqual(["q-a", "q-c"]);
    expect(toggleChoice(multi, ["q-a", "q-c"], "q-a")).toEqual(["q-c"]);
  });

  it("10 XP par séance, +5 pour un sans-faute", () => {
    expect(sessionXp(5, 5)).toBe(15);
    expect(sessionXp(4, 5)).toBe(10);
    expect(percent(4, 5)).toBe(80);
    expect(percent(0, 0)).toBe(0);
  });
});
