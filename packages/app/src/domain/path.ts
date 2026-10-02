import type { Lesson, ProgramContent, Question, Unit } from "../lib/types";

export type LessonState = "done" | "current" | "locked";
export type PathLesson = { lesson: Lesson; unit: Unit; state: LessonState };
export type PathUnit = { unit: Unit; done: boolean; lessons: PathLesson[] };

/** Parcours : une leçon est ouverte si toutes celles qui la précèdent sont terminées. */
export function buildPath(content: ProgramContent, completed: ReadonlySet<string>): PathUnit[] {
  let blocked = false;
  return content.units.map((unit) => {
    const lessons = unit.lessons.map((lesson): PathLesson => {
      let state: LessonState;
      if (completed.has(lesson.id)) state = "done";
      else if (!blocked) {
        state = "current";
        blocked = true;
      } else state = "locked";
      return { lesson, unit, state };
    });
    return { unit, done: lessons.every((l) => l.state === "done"), lessons };
  });
}

export function nextLesson(path: PathUnit[]): PathLesson | null {
  for (const unit of path) for (const l of unit.lessons) if (l.state === "current") return l;
  return null;
}

export function findLesson(content: ProgramContent, lessonId: string): { lesson: Lesson; unit: Unit } | null {
  for (const unit of content.units) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, unit };
  }
  return null;
}

export function questionIndex(content: ProgramContent): Map<string, Question> {
  const index = new Map<string, Question>();
  for (const unit of content.units) for (const lesson of unit.lessons) for (const q of lesson.questions) index.set(q.id, q);
  return index;
}

export function unitQuestions(unit: Unit): Question[] {
  return unit.lessons.flatMap((l) => l.questions);
}

/** Tirage sans remise (Fisher-Yates), `random` injectable pour les tests. */
export function sample<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
