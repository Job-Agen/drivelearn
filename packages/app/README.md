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

Sans variable, l'app utilise la production : la Function `api` et Neon Auth de la branche `br-flat-lake-b12cfxtb`
(`src/lib/config.ts`). `EXPO_PUBLIC_API_URL` et `EXPO_PUBLIC_AUTH_URL` (`.env.local`) servent à viser un autre backend.
L'app s'annonce à Neon Auth avec l'origine `https://app.drivelearn.tg`, qui doit figurer dans les domaines de confiance.

## Rappels quotidiens

Programmés sur le téléphone (`src/domain/reminders.ts`, `src/lib/notifications.ts`) : les 14 prochains jours à
l'heure choisie dans le profil, sans rappel le jour où une séance est déjà faite. L'autorisation est demandée à la
fin de la configuration (« C'est parti ») et quand l'élève active le rappel dans ses préférences.

## Application Android

Fabriquée par EAS Build (`eas.json`) via le workflow GitHub « Application Android » : à chaque fusion sur `master`
qui touche l'app, ou à la main. Profil `preview` : APK à installer directement ; `production` : AAB pour le Play
Store. Secret nécessaire : `EXPO_TOKEN`.

## Vérifications

```sh
npm test            # logique pure : notation tout ou rien, parcours, quiz, erreurs à revoir, cookies
npm run typecheck
```

## Reste à faire

- Paiement : brancher le vrai compte marchand PayGate Global (`PAYGATE_AUTH_TOKEN` dans `.env.local`, puis
  déclarer l'URL de notification `<API>/webhooks/paygate` dans le tableau de bord PayGate). En local, le serveur de
  développement simule PayGate : paiement validé 6 s après son lancement, refusé si le numéro finit par 00.
- Notifications de rappel (jeton push) : la préférence est enregistrée, l'envoi viendra avec le Plan 7.
- Contenu officiel et images (Plan 4) : `packages/db/seed/demo.sql` n'est qu'une démonstration.
- Essai sur un vrai téléphone Android contre Neon Auth (cookies de session, vérification d'e-mail).
