/** Adresse publique d'une image du contenu (stockage objet Neon en production, serveur de développement sinon). */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.IMAGES_BASE_URL ?? (process.env.NODE_ENV === "production" ? null : "http://localhost:8787/images");
  // Sans stockage d'images configuré, l'aperçu s'affiche sans image plutôt qu'avec une image cassée.
  return base ? `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : null;
}
