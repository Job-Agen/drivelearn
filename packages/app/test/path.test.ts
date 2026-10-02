import { describe, expect, it } from "vitest";
import { buildPath, nextLesson, sample } from "../src/domain/path";
import { content } from "./fixtures";

const c = content({ u1: ["l1", "l2"], u2: ["l3"] });
const states = (done: string[]) =>
  buildPath(c, new Set(done)).flatMap((u) => u.lessons.map((l) => `${l.lesson.id}:${l.state}`));

describe("parcours", () => {
  it("seule la première leçon est ouverte au départ", () => {
    expect(states([])).toEqual(["l1:current", "l2:locked", "l3:locked"]);
  });

  it("terminer une leçon ouvre la suivante, y compris dans l'unité suivante", () => {
    expect(states(["l1"])).toEqual(["l1:done", "l2:current", "l3:locked"]);
    expect(states(["l1", "l2"])).toEqual(["l1:done", "l2:done", "l3:current"]);
  });

  it("une unité est terminée quand toutes ses leçons le sont", () => {
    const path = buildPath(c, new Set(["l1", "l2"]));
    expect(path.map((u) => u.done)).toEqual([true, false]);
    expect(nextLesson(path)?.lesson.id).toBe("l3");
    expect(nextLesson(buildPath(c, new Set(["l1", "l2", "l3"])))).toBeNull();
  });

  it("tire sans remise", () => {
    const picked = sample([1, 2, 3, 4, 5], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(sample([1, 2], 5)).toHaveLength(2);
  });
});
