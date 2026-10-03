import "server-only";
import pg from "pg";

export type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> };

// Un seul pool par processus (survit au rechargement à chaud en développement).
const g = globalThis as unknown as { __adminPool?: pg.Pool };
export const pool =
  g.__adminPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/drivelearn_dev",
    max: 5,
  });
g.__adminPool = pool;

/** Plusieurs requêtes atomiques (enregistrement d'une question et de ses choix, validation…). */
export async function transaction<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
