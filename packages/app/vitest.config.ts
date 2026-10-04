import { defineConfig } from "vitest/config";

// Tests de la logique pure (src/domain, src/lib/http) : pas de React Native ici.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
