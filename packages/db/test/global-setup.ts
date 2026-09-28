import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { TEST_DATABASE_URL } from "./helpers.js";

const DATA_DIR = fileURLToPath(new URL("../.pgdata", import.meta.url));

export default async function setup() {
  // Sans TEST_DATABASE_URL, on démarre un Postgres 17 local embarqué (pas besoin de Docker).
  let server: EmbeddedPostgres | undefined;
  if (!process.env.TEST_DATABASE_URL) {
    server = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user: "postgres",
      password: "postgres",
      port: 54329,
      persistent: true,
      onLog: () => {},
    });
    const fresh = !existsSync(DATA_DIR);
    if (fresh) await server.initialise();
    await server.start();
    if (fresh) await server.createDatabase("drivelearn_test");
  }

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query("drop schema if exists public cascade; create schema public;");
  await client.end();
  await migrate(TEST_DATABASE_URL);

  return async () => {
    await server?.stop();
  };
}
