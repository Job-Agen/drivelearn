/** Erreur renvoyée à l'écran : `message` est toujours une phrase en français affichable telle quelle. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export const OFFLINE = new AppError("offline", "Pas de connexion internet. Réessaie quand tu seras en ligne.");

export function isOffline(error: unknown): boolean {
  return error instanceof AppError && error.code === "offline";
}

/** Combine plusieurs en-têtes Set-Cookie (joints par des virgules) en un en-tête Cookie. */
export function cookieFromSetCookie(header: string | null): string | null {
  if (!header) return null;
  const pairs = header
    .split(/,(?=\s*[^;,=\s]+=)/)
    .map((part) => part.trim().split(";")[0])
    .filter((pair) => pair.includes("=") && !pair.endsWith("="));
  return pairs.length ? pairs.join("; ") : null;
}

/** Date d'expiration (ms) d'un JWT, sans vérifier la signature (l'API s'en charge). */
export function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")));
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}
