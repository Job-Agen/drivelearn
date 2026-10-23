// Adresses du backend. Surchargeables par EXPO_PUBLIC_API_URL et EXPO_PUBLIC_AUTH_URL (fichier .env.local).
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://br-flat-lake-b12cfxtb-api.compute.c-5.eu-central-1.aws.neon.tech"
).replace(/\/$/, "");
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

/** Pages publiques (site DriveLearn), aussi données dans la fiche Play Store. */
export const SITE_URL = "https://drivelearn-admin.vercel.app";
export const TERMS_URL = `${SITE_URL}/conditions`;
export const PRIVACY_URL = `${SITE_URL}/confidentialite`;

/**
 * Vente du Pass Examen dans l'app (Flooz / T-Money). Désactivée : Google Play impose son propre paiement pour les
 * contenus numériques achetés dans une app. Le Pass se vend hors de l'app sous forme de code d'activation, que
 * l'élève saisit (écran 23). Le parcours de paiement reste dans le code, prêt à être réactivé.
 */
export const PASS_SALES_IN_APP = false;
