import { AdminError } from "../errors";
import type { Queryable } from "./types";

export async function isAdminUser(db: Queryable, userId: string): Promise<boolean> {
  const { rows } = await db.query("select 1 from admins where user_id = $1", [userId]);
  return rows.length > 0;
}

/** Ajoute aux administrateurs le compte Neon Auth qui porte cet e-mail. */
export async function makeAdmin(db: Queryable, email: string): Promise<string> {
  const { rows } = await db.query(`select id from neon_auth."user" where lower(email) = lower($1)`, [email.trim()]);
  if (rows.length === 0) throw new AdminError(`Aucun compte Neon Auth pour ${email}. Créez d'abord le compte.`);
  await db.query("insert into admins (user_id) values ($1) on conflict do nothing", [rows[0].id]);
  return rows[0].id as string;
}
