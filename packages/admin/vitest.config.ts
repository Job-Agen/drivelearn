import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["../db/test/global-setup.ts"],
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
