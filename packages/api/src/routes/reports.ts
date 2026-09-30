import { Hono } from "hono";
import { z } from "zod";
import { row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

const Report = z.strictObject({
  question_id: z.uuid(),
  reason: z.enum(["reponse_incorrecte", "explication_peu_claire", "probleme_image"]),
  comment: z.string().max(500).nullable().optional(),
});

export function reportRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.post("/", async (c) => {
    const body = Report.parse(await c.req.json());
    const created = await row<{ id: string }>(deps.db, "select id from create_report($1, $2, $3, $4)", [
      c.get("userId"),
      body.question_id,
      body.reason,
      body.comment ?? null,
    ]);
    return c.json({ id: created?.id }, 201);
  });
  return r;
}
