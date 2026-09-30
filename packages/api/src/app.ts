import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "./auth.js";
import { toHttpError } from "./errors.js";
import { contentRoutes } from "./routes/content.js";
import { examRoutes } from "./routes/exams.js";
import { meRoutes } from "./routes/me.js";
import { practiceRoutes } from "./routes/practice.js";
import { reportRoutes } from "./routes/reports.js";
import type { AppEnv, Deps } from "./types.js";

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.get("/health", (c) => c.json({ ok: true }));

  const v1 = new Hono<AppEnv>();
  v1.use("*", authMiddleware(deps));
  v1.route("/me", meRoutes(deps));
  v1.route("/", contentRoutes(deps));
  v1.route("/", practiceRoutes(deps));
  v1.route("/exams", examRoutes(deps));
  v1.route("/reports", reportRoutes(deps));
  app.route("/v1", v1);

  app.notFound((c) => c.json({ error: "not_found", message: "Ressource introuvable." }, 404));
  app.onError((err, c) => {
    const e = toHttpError(err);
    if (e.status >= 500) console.error(err);
    return c.json({ error: e.code, message: e.message }, e.status as ContentfulStatusCode);
  });

  return app;
}
