import pg from "pg";

const globalForPool = globalThis as unknown as { drivelearnPool?: pg.Pool };

export const pool = globalForPool.drivelearnPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") globalForPool.drivelearnPool = pool;

export async function inTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
