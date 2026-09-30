import { Hono } from "hono";
import { z } from "zod";
import { requireProgram, row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

const Id = z.uuid();
const Answer = z.strictObject({ choice_ids: z.array(z.uuid()).max(8) });

export function examRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  const value = async (sql: string, values: unknown[]) => (await row<{ v: unknown }>(deps.db, sql, values))?.v;

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const programId = await requireProgram(deps.db, userId);
    return c.json(await value("select start_exam($1, $2) as v", [userId, programId]));
  });

  r.get("/status", async (c) => c.json(await value("select get_exam_status($1) as v", [c.get("userId")])));
  r.get("/history", async (c) => c.json(await value("select get_exam_history($1) as v", [c.get("userId")])));

  r.get("/:id", async (c) => {
    const id = Id.parse(c.req.param("id"));
    return c.json(await value("select get_exam($1, $2) as v", [c.get("userId"), id]));
  });

  r.put("/:id/answers/:questionId", async (c) => {
    const id = Id.parse(c.req.param("id"));
    const questionId = Id.parse(c.req.param("questionId"));
    const { choice_ids } = Answer.parse(await c.req.json());
    await deps.db.query("select save_exam_answer($1, $2, $3, $4::uuid[])", [c.get("userId"), id, questionId, choice_ids]);
    return c.body(null, 204);
  });

  r.post("/:id/submit", async (c) => {
    const id = Id.parse(c.req.param("id"));
    return c.json(await value("select submit_exam($1, $2) as v", [c.get("userId"), id]));
  });

  return r;
}
