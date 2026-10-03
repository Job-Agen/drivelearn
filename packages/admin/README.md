# DriveLearn — site d'administration (Next.js)

Tableau de bord, programmes et paramètres d'examen (écrans 29 et 31), contenus avec circuit de validation et
aperçu élève (écran 30), signalements (écran 32), auto-écoles, ventes et commissions avec export CSV, réglages.
Le site lit et écrit directement la base Neon depuis ses routes serveur ; chaque page et chaque action vérifie
l'administrateur.

## Connexion

Les administrateurs se connectent avec leur compte Neon Auth ; le compte doit figurer dans la table `admins`.
Pour donner l'accès à un compte existant :

```sql
insert into admins (user_id) select id from neon_auth."user" where email = 'prenom@exemple.tg';
```

Retirer la ligne retire l'accès immédiatement.

## Variables d'environnement (Vercel)

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Neon (branche principale) |
| `NEON_AUTH_BASE_URL` | URL Neon Auth du projet |
| `ADMIN_ORIGIN` | Origine du site (`https://admin.drivelearn.tg`), à déclarer dans les domaines de confiance de Neon Auth |
| `ADMIN_SESSION_SECRET` | Secret aléatoire d'au moins 32 caractères pour signer la session |
| `IMAGES_BASE_URL` | Adresse publique des images du contenu |

## En local

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/drivelearn_dev npm run dev -w @drivelearn/api   # API + faux Neon Auth
npm run dev -w @drivelearn/admin                                                                          # http://localhost:3001
```

Compte de développement : `admin@drivelearn.tg` / `admin12345`.

Tests (requêtes sur la base de test) : `npm test -w @drivelearn/admin`.

## Reste à faire

- Envoi d'images depuis l'éditeur (stockage objet Neon, Plan 4) : pour l'instant on saisit le chemin de l'image.
