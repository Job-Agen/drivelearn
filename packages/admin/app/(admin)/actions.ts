"use server";

import { redirect } from "next/navigation";
import { pool, transaction } from "@/lib/db";
import * as q from "@/lib/queries";
import { login, logout, requestPasswordReset, requireAdmin, resetPassword } from "@/lib/session";

// Chaque action vérifie l'administrateur, puis revient sur la page avec un message (?ok=… ou ?error=…).

function back(path: string, kind: "ok" | "error", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "");
}
function int(form: FormData, key: string): number {
  return Number.parseInt(text(form, key), 10);
}

async function run(path: string, ok: string, fn: () => Promise<unknown>): Promise<never> {
  await requireAdmin();
  try {
    await fn();
  } catch (error) {
    back(path, "error", q.explainDbError(error));
  }
  back(path, "ok", ok);
}

// Connexion ---------------------------------------------------------------------------------------------

export type LoginState = { error: string; email: string } | null;

/** En cas d'échec, renvoie l'e-mail saisi : React vide le formulaire après chaque envoi. */
export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const error = await login(text(form, "email"), text(form, "password"));
  if (error) return { error, email: text(form, "email") };
  redirect("/");
}

export async function requestResetAction(_: string | null, form: FormData): Promise<string | null> {
  const email = text(form, "email");
  if (!email.includes("@")) return "Adresse e-mail invalide.";
  await requestPasswordReset(email);
  return "Si ce compte existe, un lien vient d'être envoyé à cette adresse. Pense à regarder dans les courriers indésirables.";
}

export async function resetPasswordAction(_: string | null, form: FormData): Promise<string | null> {
  const password = text(form, "password");
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (password !== text(form, "confirm")) return "Les deux mots de passe ne sont pas identiques.";
  const error = await resetPassword(text(form, "token"), password);
  if (error) return error;
  redirect(`/login?ok=${encodeURIComponent("Mot de passe enregistré. Tu peux te connecter.")}`);
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

// Programmes et examens --------------------------------------------------------------------------------------

export async function createProgramAction(form: FormData) {
  await requireAdmin();
  let id: string | undefined;
  try {
    id = (await q.createProgram(pool, { country: text(form, "country"), license: text(form, "license") || "B", name: text(form, "name") }))?.id;
  } catch (error) {
    back("/programmes", "error", q.explainDbError(error));
  }
  redirect(`/programmes/${id}?ok=${encodeURIComponent("Programme créé.")}`);
}

export async function examSettingsAction(form: FormData) {
  const id = text(form, "id");
  const distribution: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("dist_")) distribution[key.slice(5)] = Number.parseInt(String(value), 10) || 0;
  }
  await run(`/programmes/${id}`, "Paramètres d'examen enregistrés.", () =>
    q.updateExamSettings(pool, id, { count: int(form, "count"), passMark: int(form, "passMark"), seconds: int(form, "seconds"), distribution }),
  );
}

export async function programStatusAction(form: FormData) {
  const id = text(form, "id");
  const status = text(form, "status") as q.ProgramStatus;
  await run(`/programmes/${id}`, status === "publie" ? "Programme publié : les élèves y ont accès." : "Statut du programme modifié.", () =>
    q.setProgramStatus(pool, id, status),
  );
}

// Contenus --------------------------------------------------------------------------------------------------

export async function createUnitAction(form: FormData) {
  const program = text(form, "program");
  await run(`/contenus?program=${program}`, "Unité créée.", () => q.createUnit(pool, program, text(form, "title")));
}

export async function renameUnitAction(form: FormData) {
  const program = text(form, "program");
  await run(`/contenus?program=${program}`, "Unité renommée.", () => q.renameUnit(pool, text(form, "id"), text(form, "title")));
}

export async function createLessonAction(form: FormData) {
  const program = text(form, "program");
  await requireAdmin();
  let id: string | undefined;
  try {
    id = (await q.createLesson(pool, text(form, "unit"), text(form, "title")))?.id;
  } catch (error) {
    back(`/contenus?program=${program}`, "error", q.explainDbError(error));
  }
  redirect(`/contenus/lecons/${id}?ok=${encodeURIComponent("Leçon créée : complète son écran d'explication.")}`);
}

export async function saveLessonAction(form: FormData) {
  const id = text(form, "id");
  await run(`/contenus/lecons/${id}`, "Leçon enregistrée.", () =>
    q.updateLesson(pool, id, {
      title: text(form, "title"),
      introTitle: text(form, "introTitle"),
      introText: text(form, "introText"),
      introImagePath: text(form, "introImagePath"),
      mentorTip: text(form, "mentorTip"),
    }),
  );
}

export async function saveQuestionAction(form: FormData) {
  await requireAdmin();
  const existing = text(form, "id") || null;
  const choices: q.ChoiceInput[] = [];
  for (let i = 0; i < 8; i++) {
    choices.push({ id: text(form, `choice_id_${i}`) || undefined, label: text(form, `label_${i}`), isCorrect: form.get(`correct_${i}`) === "on" });
  }
  const [unitId, lessonId] = text(form, "placement").split("|");
  const input: q.QuestionInput = {
    unitId,
    lessonId: lessonId || null,
    prompt: text(form, "prompt"),
    imagePath: text(form, "imagePath"),
    explanation: text(form, "explanation"),
    source: text(form, "source"),
    choices,
  };
  let id: string | undefined;
  try {
    id = await transaction((db) => q.saveQuestion(db, existing, input));
  } catch (error) {
    back(existing ? `/contenus/questions/${existing}` : "/contenus", "error", q.explainDbError(error));
  }
  redirect(`/contenus/questions/${id}?ok=${encodeURIComponent("Question enregistrée.")}`);
}

export async function questionStatusAction(form: FormData) {
  const id = text(form, "id");
  const status = text(form, "status") as q.QuestionStatus;
  const labels: Record<string, string> = {
    en_validation: "Question soumise à validation.",
    validee: "Question validée : elle est servie aux élèves.",
    brouillon: "Question repassée en brouillon.",
    a_verifier: "Question marquée à vérifier.",
  };
  // La base contrôle une question validée à la fin de la transaction (choix, leçon, explication, source).
  await run(`/contenus/questions/${id}`, labels[status] ?? "Statut modifié.", () => transaction((db) => q.setQuestionStatus(db, id, status)));
}

export async function deleteQuestionAction(form: FormData) {
  const id = text(form, "id");
  const program = text(form, "program");
  await requireAdmin();
  try {
    await q.deleteQuestion(pool, id);
  } catch (error) {
    back(`/contenus/questions/${id}`, "error", q.explainDbError(error));
  }
  redirect(`/contenus?program=${program}&ok=${encodeURIComponent("Question supprimée.")}`);
}

// Signalements -----------------------------------------------------------------------------------------------

export async function reportAction(form: FormData) {
  const from = text(form, "from") || "/signalements";
  await run(from, "Signalement mis à jour.", () =>
    q.updateReport(pool, text(form, "id"), text(form, "status") as q.ReportStatus, text(form, "note")),
  );
}

// Auto-écoles ------------------------------------------------------------------------------------------------

export async function saveSchoolAction(form: FormData) {
  const id = text(form, "id") || null;
  await run("/auto-ecoles", id ? "Auto-école modifiée." : "Auto-école créée.", () =>
    q.saveSchool(pool, id, {
      name: text(form, "name"),
      promoCode: text(form, "promoCode"),
      discount: int(form, "discount"),
      commission: int(form, "commission"),
      active: form.get("active") === "on",
    }),
  );
}

// Réglages ----------------------------------------------------------------------------------------------------

export async function settingsAction(form: FormData) {
  const values: Record<string, number> = {};
  for (const key of Object.keys(q.SETTINGS)) values[key] = int(form, key);
  await run("/reglages", "Réglages enregistrés.", () => q.updateSettings(pool, values));
}
