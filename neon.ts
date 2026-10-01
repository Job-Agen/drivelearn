import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    api: {
      name: "DriveLearn API",
      source: "./packages/api/src/function.ts",
      env: {
        // Transmise seulement si présente (neon deploy --env .env.production) : une valeur vide supprimerait la variable.
        ...(process.env.NEON_API_KEY ? { NEON_API_KEY: process.env.NEON_API_KEY } : {}),
        NEON_PROJECT_ID: "young-river-14219375",
        NEON_BRANCH_ID: "br-flat-lake-b12cfxtb",
        // Temporaire : à repasser à "true" une fois la vérification d'e-mail activée dans Neon Auth.
        REQUIRE_VERIFIED_EMAIL: "false",
      },
    },
  },
});
