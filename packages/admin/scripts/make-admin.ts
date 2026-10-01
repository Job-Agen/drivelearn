// Usage : npm run make-admin -w @drivelearn/admin -- email@exemple.tg   (lit DATABASE_URL dans ../../.env.local)
import { readFileSync } from "node:fs";
import pg from "pg";
import { makeAdmin } from "../lib/data/admins";

const email = process.argv[2];
if (!email) {
  console.error("Indiquez l'e-mail du compte à nommer administrateur.");
  process.exit(1);
}
const line = readFileSync(new URL("../../../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "") });
await client.connect();
try {
  const id = await makeAdmin(client, email);
  console.log(`${email} est administrateur (${id}).`);
} finally {
  await client.end();
}
