# DriveLearn — application élève (Expo, Android)

Parcours de leçons, quiz, révision des erreurs, progrès, examens blancs, profil. Le contenu est téléchargé
une fois puis jouable hors ligne ; les séances sont gardées sur le téléphone et envoyées à la reconnexion.

## Lancer en local, sans toucher au projet Neon

```sh
# 1. Base Postgres locale + contenu de démonstration
createdb drivelearn_dev
DATABASE_URL=postgres://postgres:postgres@localhost:5432/drivelearn_dev npm run dev -w @drivelearn/api   # migre et écoute sur :8787
psql postgres://postgres:postgres@localhost:5432/drivelearn_dev -f packages/db/seed/demo.sql

# 2. Application (navigateur ou Expo Go / build de développement)
cd packages/app
EXPO_PUBLIC_API_URL=http://localhost:8787 EXPO_PUBLIC_AUTH_URL=http://localhost:8787/auth npx expo start
```

Le serveur de développement remplace Neon Auth par un faux service en mémoire (comptes perdus au redémarrage).
Sur un téléphone, remplacer `localhost` par l'adresse IP de l'ordinateur.

## Contre le backend Neon

Copier `.env.example` en `.env.local` et renseigner `EXPO_PUBLIC_API_URL` (URL de la Function `api`).
L'app s'annonce à Neon Auth avec l'origine `https://app.drivelearn.tg`, qui doit figurer dans les domaines de confiance.

## Vérifications

```sh
npm test            # logique pure : notation tout ou rien, parcours, quiz, erreurs à revoir, cookies
npm run typecheck
```

## Reste à faire

- Paiement du Pass Examen (Flooz, T-Money) : l'écran Examens l'annonce « bientôt ».
- Notifications de rappel (jeton push) : la préférence est enregistrée, l'envoi viendra avec le Plan 7.
- Contenu officiel et images (Plan 4) : `packages/db/seed/demo.sql` n'est qu'une démonstration.
- Essai sur un vrai téléphone Android contre Neon Auth (cookies de session, vérification d'e-mail).
