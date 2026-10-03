/** Adresse publique d'une image du contenu (stockage objet Neon en production, serveur de développement sinon). */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = (process.env.IMAGES_BASE_URL ?? "http://localhost:8787/images").replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
