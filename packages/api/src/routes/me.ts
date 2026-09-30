import { Hono } from "hono";
import { row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

export async function getMe(deps: Deps, userId: string) {
  return row(
    deps.db,
    `select p.id, p.email, p.first_name, p.program_id, p.daily_goal_minutes, p.reminder_enabled,
            to_char(p.reminder_time, 'HH24:MI') as reminder_time, s.name as driving_school_name
     from profiles p left join driving_schools s on s.id = p.driving_school_id
     where p.id = $1`,
    [userId],
  );
}

export function meRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.get("/", async (c) => c.json(await getMe(deps, c.get("userId"))));
  return r;
}
