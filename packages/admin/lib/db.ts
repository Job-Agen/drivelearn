import "server-only";
import pg from "pg";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") throw new Error("Variable d'environnement manquante : DATABASE_URL");
  return "postgres://postgres:postgres@localhost:5432/drivelearn_dev";
}

export type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> };

// Un seul pool par processus (survit au rechargement à chaud en développement), créé à la première requête :
// le build n'a pas besoin de la base.
const g = globalThis as unknown as { __adminPool?: pg.Pool };
function getPool(): pg.Pool {
  g.__adminPool ??= new pg.Pool({ connectionString: databaseUrl(), max: 5 });
  return g.__adminPool;
}

export const pool = {
  query: (text: string, values?: unknown[]) => getPool().query(text, values),
  connect: () => getPool().connect(),
};

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
