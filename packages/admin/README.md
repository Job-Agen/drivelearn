# DriveLearn — site d'administration (Next.js, Vercel)

## Variables d'environnement (Vercel)

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Neon avec connection pooling (console Neon → Connect) |
| `NEON_AUTH_BASE_URL` | URL Neon Auth du projet |
| `NEON_AUTH_COOKIE_SECRET` | Secret aléatoire d'au moins 32 caractères (cookies de session) |

L'adresse du site doit figurer dans les domaines de confiance de Neon Auth.

## Administrateurs

`npm run make-admin -w @drivelearn/admin -- email@exemple.tg` (lit `DATABASE_URL` dans `.env.local`).
Un compte créé sans mot de passe choisit le sien via « Premier accès ou mot de passe oublié ? » sur la page
de connexion (lien envoyé par Neon Auth vers `/auth/nouveau-mot-de-passe`).
