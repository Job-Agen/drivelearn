# DriveLearn — site d'administration (Next.js, Vercel)

## Variables d'environnement (Vercel)

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Neon avec connection pooling (console Neon → Connect) |
| `NEON_AUTH_BASE_URL` | URL Neon Auth du projet |
| `NEON_AUTH_COOKIE_SECRET` | Secret aléatoire d'au moins 32 caractères (cookies de session) |
| `STORAGE_ENDPOINT` | Point d'accès S3 du stockage de la branche Neon |
| `STORAGE_REGION` | `eu-central-1` |
| `STORAGE_BUCKET` | `question-images` (bucket en lecture publique) |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Identifiant Neon `storage:read` + `storage:write` (`token_id`, `s3_secret_access_key`) |
| `IMAGES_BASE_URL` | Adresse publique du bucket (`<STORAGE_ENDPOINT>/question-images`), aussi donnée à l'API dans `neon.ts` |

L'adresse du site doit figurer dans les domaines de confiance de Neon Auth.

Les variables de stockage ne s'appellent pas `AWS_*` : ces noms sont réservés par Vercel. Sans elles, le site
fonctionne, mais l'envoi d'images répond « L'envoi d'images n'est pas configuré sur ce serveur ».

## Administrateurs

`npm run make-admin -w @drivelearn/admin -- email@exemple.tg` (lit `DATABASE_URL` dans `.env.local`).
Un compte créé sans mot de passe choisit le sien via « Premier accès ou mot de passe oublié ? » sur la page
de connexion (lien envoyé par Neon Auth vers `/auth/nouveau-mot-de-passe`).
