// Adresses du backend. Surchargeables par EXPO_PUBLIC_API_URL et EXPO_PUBLIC_AUTH_URL (fichier .env.local).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const AUTH_URL = (
  process.env.EXPO_PUBLIC_AUTH_URL ??
  "https://ep-small-glade-b1t7owsk.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth"
).replace(/\/$/, "");

/** Neon Auth refuse les requêtes sans origine de confiance : l'app se présente avec celle-ci. */
export const APP_ORIGIN = "https://app.drivelearn.tg";

/** Barème affiché en fin de séance ; le serveur reste seul juge des XP réellement gagnés. */
export const XP_PER_SESSION = 10;
export const XP_PERFECT_BONUS = 5;
export const REVIEW_BATCH = 10;
