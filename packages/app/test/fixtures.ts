import type { Lesson, ProgramContent, Question } from "../src/lib/types";

export function question(id: string, correct: string[], choices = ["a", "b", "c"]): Question {
  return {
    id,
    prompt: `Question ${id}`,
    image_path: null,
    explanation: null,
    multiple: correct.length > 1,
    choices: choices.map((c) => ({ id: `${id}-${c}`, label: c, is_correct: correct.includes(c) })),
  };
}

export function lesson(id: string, questions: Question[] = [question(`${id}q`, ["a"])]): Lesson {
  return { id, title: id, position: 0, intro_title: null, intro_text: null, intro_image_path: null, mentor_tip: null, questions };
}

export function content(units: Record<string, string[]>): ProgramContent {
  return {
    program: { id: "p", name: "Togo", exam_question_count: 20, exam_pass_mark: 13, exam_seconds_per_question: 30 },
    units: Object.entries(units).map(([id, lessons], position) => ({
      id,
      title: id,
      position,
      lessons: lessons.map((l) => lesson(l)),
    })),
  };
}
