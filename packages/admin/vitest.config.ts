import { defineConfig } from "vitest/config";

// Requêtes du site d'administration, testées sur la base de test (mêmes migrations que packages/db).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["../db/test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
