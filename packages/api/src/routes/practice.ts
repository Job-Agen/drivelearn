import { Hono } from "hono";
import { z } from "zod";
import { requireProgram, row } from "../db.js";
import { toHttpError } from "../errors.js";
import type { AppEnv, Deps } from "../types.js";

const Session = z.object({
  id: z.uuid(),
  kind: z.enum(["lecon", "erreurs", "theme"]),
  lesson_id: z.uuid().nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  completed_at: z.iso.datetime({ offset: true }),
  active_seconds: z.number().int().nonnegative(),
  answers: z
    .array(z.object({ question_id: z.uuid(), choice_ids: z.array(z.uuid()).max(8) }))
    .min(1)
    .max(100),
});
const SessionBatch = z.object({ sessions: z.array(Session).min(1).max(50) });
const ReviewQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export function practiceRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.post("/sessions", async (c) => {
    const userId = c.get("userId");
    const { sessions } = SessionBatch.parse(await c.req.json());
    const results = [];
    for (const s of sessions) {
      try {
        const saved = await row(
          deps.db,
          `select xp_earned, correct_count, question_count
           from submit_session($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, s.id, s.kind, s.lesson_id ?? null, s.unit_id ?? null, s.completed_at, s.active_seconds, JSON.stringify(s.answers)],
        );
        results.push({ id: s.id, status: "ok", ...saved });
      } catch (error) {
        const e = toHttpError(error);
        if (e.status >= 500) throw error; // panne : l'app réessaiera tout le lot
        results.push({ id: s.id, status: "rejected", error: e.code });
      }
    }
    return c.json({ results });
  });

  r.get("/review", async (c) => {
    const { limit } = ReviewQuery.parse(c.req.query());
    const userId = c.get("userId");
    const programId = await requireProgram(deps.db, userId);
    const result = await row<{ ids: string[] }>(deps.db, "select get_review_questions($1, $2, $3) as ids", [userId, programId, limit]);
    return c.json({ question_ids: result?.ids ?? [] });
  });

  r.get("/progress", async (c) => {
    const userId = c.get("userId");
    const result = await row<{ progress: Record<string, unknown> }>(deps.db, "select get_progress($1) as progress", [userId]);
    // Leçons terminées : l'app en déduit le parcours débloqué, même après une réinstallation.
    const { rows } = await deps.db.query(
      "select distinct lesson_id from practice_sessions where user_id = $1 and kind = 'lecon' and lesson_id is not null",
      [userId],
    );
    return c.json({ ...result?.progress, completed_lesson_ids: rows.map((r: { lesson_id: string }) => r.lesson_id) });
  });

  return r;
}
