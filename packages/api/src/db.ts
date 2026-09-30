import { HttpError } from "./errors.js";
import type { Queryable } from "./types.js";

export async function row<T = any>(db: Queryable, sql: string, values: unknown[] = []): Promise<T | undefined> {
  const { rows } = await db.query(sql, values);
  return rows[0] as T | undefined;
}

/** Programme choisi par l'élève (pays + permis), obligatoire pour le contenu et les examens. */
export async function requireProgram(db: Queryable, userId: string): Promise<string> {
  const profile = await row<{ program_id: string | null }>(db, "select program_id from profiles where id = $1", [userId]);
  if (!profile?.program_id) {
    throw new HttpError(409, "program_not_selected", "Choisissez d'abord votre pays et votre permis.");
  }
  return profile.program_id;
}
