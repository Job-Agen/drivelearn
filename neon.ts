import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    api: {
      name: "DriveLearn API",
      source: "./packages/api/src/function.ts",
      env: {
        NEON_API_KEY: process.env.NEON_API_KEY!,
        NEON_PROJECT_ID: "young-river-14219375",
        NEON_BRANCH_ID: "br-flat-lake-b12cfxtb",
        REQUIRE_VERIFIED_EMAIL: "true",
      },
    },
  },
});
