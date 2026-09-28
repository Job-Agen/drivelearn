import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrate } from "../src/migrate.js";
import { TEST_DATABASE_URL, scalar, withTx } from "./helpers.js";

describe("migrations", () => {
  it("n'applique rien une seconde fois", async () => {
    expect(await migrate(TEST_DATABASE_URL)).toEqual([]);
  });

  it("trace chaque fichier de migration appliqué", () =>
    withTx(async (db) => {
      const files = (await readdir(new URL("../migrations/", import.meta.url))).filter((f) => f.endsWith(".sql"));
      const count = await scalar<number>(db, "select count(*)::int from schema_migrations");
      expect(count).toBe(files.length);
    }));
});
