import { ZodError } from "zod";

/** Erreur métier dont le message (en français) peut être montré tel quel à l'administrateur. */
export class AdminError extends Error {}

export function adminMessage(err: unknown): string {
  if (err instanceof AdminError) return err.message;
  if (err instanceof ZodError) return `Formulaire invalide : ${err.issues.map((i) => i.message).join(", ")}`;
  const e = err as { code?: string; message?: string };
  if (e?.message?.startsWith("question_invalide: ")) {
    return `Validation impossible : ${e.message.slice("question_invalide: ".length)}.`;
  }
  if (e?.code === "23505") return "Cette valeur existe déjà.";
  if (e?.code && ["23514", "23503", "22P02", "22007"].includes(e.code)) return "Valeur invalide.";
  console.error(err);
  return "Erreur inattendue. Réessayez.";
}
