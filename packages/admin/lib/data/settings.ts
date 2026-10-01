import { z } from "zod";
import type { Queryable } from "./types";

const Settings = z.object({
  pass_price_xof: z.number().int().min(0).max(1_000_000),
  pass_duration_days: z.number().int().min(1).max(365),
  xp_per_session: z.number().int().min(0).max(1000),
  xp_perfect_bonus: z.number().int().min(0).max(1000),
  ready_after_consecutive_passes: z.number().int().min(1).max(20),
  max_review_per_lesson: z.number().int().min(0).max(8),
});
export type SettingsValues = z.infer<typeof Settings>;

export async function getSettings(db: Queryable): Promise<SettingsValues> {
  const { rows } = await db.query("select key, (value #>> '{}')::int as value from settings where key = any($1)", [
    Object.keys(Settings.shape),
  ]);
  return Settings.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function updateSettings(db: Queryable, input: Partial<SettingsValues>): Promise<void> {
  const values = Settings.partial().parse(input);
  for (const [key, value] of Object.entries(values)) {
    await db.query("update settings set value = to_jsonb($2::int) where key = $1", [key, value]);
  }
}
