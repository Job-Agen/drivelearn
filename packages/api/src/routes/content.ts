import { Hono } from "hono";
import { z } from "zod";
import { requireProgram, row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

const ContentQuery = z.object({ version: z.coerce.number().int().nonnegative().optional() });

export function contentRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.get("/programs", async (c) => {
    const { rows } = await deps.db.query(
      `select id, country_code, license_type, name, status = 'publie' as available
       from programs order by country_code, license_type`,
    );
    return c.json(rows);
  });

  r.get("/content", async (c) => {
    const { version } = ContentQuery.parse(c.req.query());
    const programId = await requireProgram(deps.db, c.get("userId"));
    const current = await row<{ version: number }>(deps.db, "select version::int as version from content_version");
    if (version !== undefined && version === current?.version) {
      return c.json({ changed: false, version });
    }
    const data = await row<{ content: unknown; max_review: number }>(
      deps.db,
      "select get_program_content($1) as content, setting_int('max_review_per_lesson') as max_review",
      [programId],
    );
    return c.json({
      changed: true,
      version: current?.version,
      images_base_url: deps.imagesBaseUrl,
      max_review_per_lesson: data?.max_review,
      content: data?.content,
    });
  });

  return r;
}
