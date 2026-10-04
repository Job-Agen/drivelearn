export type Choice = { id: string; label: string; is_correct: boolean };
export type Question = {
  id: string;
  prompt: string;
  image_path: string | null;
  explanation: string | null;
  multiple: boolean;
  choices: Choice[];
};
export type Lesson = {
  id: string;
  title: string;
  position: number;
  intro_title: string | null;
  intro_text: string | null;
  intro_image_path: string | null;
  mentor_tip: string | null;
  questions: Question[];
};
export type Unit = { id: string; title: string; position: number; lessons: Lesson[] };
export type ProgramContent = {
  program: {
    id: string;
    name: string;
    exam_question_count: number;
    exam_pass_mark: number;
    exam_seconds_per_question: number;
  };
  units: Unit[];
};
export type ContentBundle = {
  version: number;
  images_base_url: string | null;
  max_review_per_lesson: number;
  content: ProgramContent;
};

export type Program = { id: string; country_code: string; license_type: string; name: string; available: boolean };

export type Me = {
  id: string;
  email: string | null;
  first_name: string | null;
  program_id: string | null;
  daily_goal_minutes: 5 | 10 | 15;
  reminder_enabled: boolean;
  reminder_time: string;
  driving_school_name: string | null;
};

export type Progress = {
  current_streak: number;
  practiced_today: boolean;
  total_xp: number;
  daily_goal_minutes: number;
  today_minutes: number;
  week_days: boolean[];
  lessons_completed: number;
  lessons_total: number;
  themes: { unit_id: string; title: string; answers: number; correct_rate: number }[];
  milestones: Record<"first_lesson" | "streak_3" | "streak_7" | "streak_30" | "first_exam_passed", boolean>;
  completed_lesson_ids: string[];
};

export type SessionKind = "lecon" | "erreurs" | "theme";
export type Answer = { question_id: string; choice_ids: string[] };
export type PendingSession = {
  id: string;
  kind: SessionKind;
  lesson_id: string | null;
  unit_id: string | null;
  completed_at: string;
  active_seconds: number;
  answers: Answer[];
};

export type ReportReason = "reponse_incorrecte" | "explication_peu_claire" | "probleme_image";

export type ExamStatus = Record<string, unknown>;
export type ExamQuestion = {
  id: string;
  prompt: string;
  image_path: string | null;
  multiple: boolean;
  explanation: string | null;
  selected: string[] | null;
  is_correct: boolean | null;
  choices: { id: string; label: string; is_correct: boolean | null }[];
};
export type Exam = {
  attempt_id: string;
  started_at: string;
  expires_at: string;
  seconds_per_question: number;
  pass_mark: number;
  total: number;
  submitted: boolean;
  score: number | null;
  passed: boolean | null;
  questions: ExamQuestion[];
};
