import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Même base de test que packages/db : Postgres embarqué, schéma remis à zéro, migrations appliquées.
    globalSetup: ["../db/test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
