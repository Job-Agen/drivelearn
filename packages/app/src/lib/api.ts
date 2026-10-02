import { auth } from "./auth";
import { API_URL } from "./config";
import { AppError, OFFLINE } from "./http";
import type {
  Answer,
  ContentBundle,
  Exam,
  Me,
  PendingSession,
  Program,
  Progress,
  ReportReason,
} from "./types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new AppError("config", "Adresse de l'API manquante (EXPO_PUBLIC_API_URL).");
  const token = await auth.token();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw OFFLINE;
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AppError(json?.error ?? "error", json?.message ?? "Une erreur est survenue. Réessayez.", res.status);
  }
  return json as T;
}

export type ContentResponse = ({ changed: true } & ContentBundle) | { changed: false; version: number };
export type SessionResult = {
  id: string;
  status: "ok" | "rejected";
  error?: string;
  xp_earned?: number;
  correct_count?: number;
  question_count?: number;
};

export const api = {
  me: () => request<Me>("GET", "/me"),
  updateMe: (patch: Partial<Omit<Me, "id" | "email" | "driving_school_name">> & { push_token?: string | null }) =>
    request<Me>("PATCH", "/me", patch),
  setPromoCode: (code: string | null) =>
    request<{ driving_school_name: string | null }>("POST", "/me/promo-code", { code }),
  deleteAccount: () => request<void>("DELETE", "/me"),

  programs: () => request<Program[]>("GET", "/programs"),
  content: (version?: number) =>
    request<ContentResponse>("GET", `/content${version === undefined ? "" : `?version=${version}`}`),

  submitSessions: (sessions: PendingSession[]) =>
    request<{ results: SessionResult[] }>("POST", "/sessions", { sessions }),
  review: (limit: number) => request<{ question_ids: string[] }>("GET", `/review?limit=${limit}`),
  progress: () => request<Progress>("GET", "/progress"),

  report: (question_id: string, reason: ReportReason, comment: string | null) =>
    request<{ id: string }>("POST", "/reports", { question_id, reason, comment }),

  examStatus: () =>
    request<{
      has_pass: boolean;
      pass_ends_at: string | null;
      free_exam_available: boolean;
      exams_taken: number;
      consecutive_passes: number;
      required_passes: number;
      ready: boolean;
    }>("GET", "/exams/status"),
  examHistory: () =>
    request<{ attempt_id: string; submitted_at: string | null; score: number | null; total: number; passed: boolean | null }[]>(
      "GET",
      "/exams/history",
    ),
  startExam: () => request<Exam>("POST", "/exams"),
  exam: (id: string) => request<Exam>("GET", `/exams/${id}`),
  saveExamAnswer: (id: string, answer: Answer) =>
    request<void>("PUT", `/exams/${id}/answers/${answer.question_id}`, { choice_ids: answer.choice_ids }),
  submitExam: (id: string) => request<Exam>("POST", `/exams/${id}/submit`),
};
