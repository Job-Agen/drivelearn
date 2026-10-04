import { redirect } from "next/navigation";
import { auth } from "./auth/server";
import { isAdminUser } from "./data/admins";
import { pool } from "./db";

/** À appeler en tête de chaque page et de chaque action serveur de l'administration. */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");
  if (!(await isAdminUser(pool, session.user.id))) redirect("/auth/refuse");
  return { userId: session.user.id, email: session.user.email };
}
