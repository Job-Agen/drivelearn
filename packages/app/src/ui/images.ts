import type { ContentBundle } from "../lib/types";

export function imageUrl(bundle: ContentBundle | null, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = bundle?.images_base_url;
  return base ? `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : null;
}
