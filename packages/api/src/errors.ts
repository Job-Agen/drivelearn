import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Erreurs levées par les fonctions SQL du Plan 1 (raise exception '<code>')
const BUSINESS_ERRORS: Record<string, [number, string]> = {
  profile_not_found: [404, "Profil introuvable."],
  program_not_found: [404, "Programme introuvable."],
  exam_not_found: [404, "Examen introuvable."],
  pass_required: [402, "Un Pass Examen est nécessaire pour passer un autre examen blanc."],
  not_enough_questions: [409, "Pas encore assez de questions pour composer un examen blanc."],
  exam_closed: [409, "Cet examen est terminé."],
  question_not_in_exam: [400, "Cette question ne fait pas partie de l'examen."],
  session_conflict: [409, "Cette séance appartient à un autre compte."],
  invalid_session: [400, "Séance incomplète."],
  invalid_answers: [400, "La séance ne contient aucune réponse."],
  unknown_question: [422, "Cette question n'est plus disponible."],
  invalid_promo_code: [400, "Code promo invalide."],
  promo_locked: [409, "Le code promo ne peut plus être modifié après un achat."],
  too_many_reports: [429, "Trop de signalements aujourd'hui. Réessayez demain."],
};

const INVALID_INPUT_SQLSTATES = new Set(["23514", "23503", "22P02", "22007", "22008"]);

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  // SyntaxError : corps JSON mal formé ou vide (c.req.json())
  if (err instanceof ZodError || err instanceof SyntaxError) {
    return new HttpError(400, "invalid_input", "Données invalides.");
  }
  const pgError = err as { code?: string; message?: string };
  if (pgError?.code === "P0001" && pgError.message && pgError.message in BUSINESS_ERRORS) {
    const [status, message] = BUSINESS_ERRORS[pgError.message];
    return new HttpError(status, pgError.message, message);
  }
  if (pgError?.code && INVALID_INPUT_SQLSTATES.has(pgError.code)) {
    return new HttpError(400, "invalid_input", "Données invalides.");
  }
  return new HttpError(500, "internal_error", "Erreur interne. Réessayez plus tard.");
}
