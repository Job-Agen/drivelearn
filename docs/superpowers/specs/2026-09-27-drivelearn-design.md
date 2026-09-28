# DriveLearn — Design (V1)

Date : 2026-09-27 — révisé le 2026-09-28 (passage à Neon, alignement sur le prototype)
Statut : révisé, en attente de relecture

Référence visuelle : prototype en 9 planches (écrans 01 à 32), fourni le 2026-09-28. Les écrans sont cités par leur numéro. En cas de conflit entre le prototype et ce document, **ce document fait foi** (voir §9).

## 1. Objectif

DriveLearn est une application Android d'apprentissage du code de la route, au fonctionnement inspiré de Duolingo. L'élève progresse par courtes leçons dans un parcours ludique, puis s'entraîne avec des examens blancs conformes à l'examen officiel.

- **Marché V1** : Togo, permis voiture, interface en français. Le modèle de données prévoit plusieurs pays ; Bénin et Côte d'Ivoire apparaissent « Bientôt » sans contenu.
- **Utilisateur payant** : l'élève, par mobile money (Flooz, T-Money).
- **Auto-écoles** : canal de distribution. Elles diffusent un code promo et touchent une commission sur les ventes associées.
- **Critère de succès V1** : un élève peut créer un compte, suivre le parcours gratuit, réviser ses erreurs, acheter un Pass Examen et passer des examens blancs notés comme l'examen officiel ; l'administrateur peut faire valider le contenu, traiter les signalements et calculer les commissions dues.

## 2. Périmètre

### Inclus en V1
- Comptes par e-mail + mot de passe (vérification d'e-mail, mot de passe oublié, suppression de compte)
- Accueil et configuration : pays, type de permis, prénom, objectif quotidien (écrans 01–08)
- Parcours de leçons à débloquer ; chaque leçon = écran d'explication + quiz (écrans 08–12)
- Révision : mes erreurs, révision par thème (écrans 13–14)
- Série de jours, XP, objectif quotidien en minutes, rappel quotidien à heure choisie
- Examens blancs : 1 gratuit, puis Pass Examen payant ; résultat, correction, historique (écrans 15–18, 20)
- Progrès : série, XP, avancement, régularité de la semaine, réussite par thème, jalons (écran 19)
- Profil et préférences (écrans 21–22), Pass Examen et son état (écrans 23–24, 28, adaptés, voir §6)
- Signalement d'une question par l'élève (écran 26)
- Paiement mobile money via passerelle, codes promo d'auto-écoles, commissions
- Administration web : programmes par pays, contenus et validation, paramètres d'examen, signalements, auto-écoles, ventes (écrans 29–32 + écrans à ajouter pour auto-écoles et ventes)
- Numérisation initiale du contenu à partir des scans fournis

### Exclu de V1
iOS, classement entre élèves, espace auto-école, ligues, cœurs (vies), abonnement récurrent, gel de série, connexion par téléphone/SMS, contenu pour d'autres pays que le Togo, autres permis que voiture.

## 3. Règles de l'examen officiel (Togo)

- 20 questions, notées sur 20 (1 point par question).
- Admis si note ≥ 13/20, ajourné sinon.
- Une question peut avoir une ou plusieurs bonnes réponses, avec jusqu'à 8 choix proposés.
- Notation **tout ou rien** : la question vaut 1 seulement si l'ensemble des choix cochés est exactement l'ensemble des bonnes réponses ; sinon 0.
- Ces règles s'appliquent aux leçons, aux révisions et aux examens blancs.
- Chaque question est chronométrée ; pas de retour en arrière.
- Le temps par question est un réglage du programme (valeur officielle à confirmer).
- L'écran de question indique « Une seule réponse » ou « Plusieurs réponses possibles » selon le nombre de bonnes réponses, en leçon comme en examen (écran 10).

## 4. Parcours, leçons et révision

### Structure du contenu
- **Programme** : un pays + un type de permis (V1 : Togo, voiture). Porte ses propres paramètres d'examen.
- **Unité (thème)** : grand thème ordonné (ex. signalisation, priorités, stationnement, croisements et dépassements, sécurité et secours).
- **Leçon** : un écran d'explication (titre, texte court, image, conseil du mentor) suivi d'un quiz d'environ 5 à 8 questions de l'unité.
- **Question** : énoncé, image optionnelle, 2 à 8 choix, une ou plusieurs bonnes réponses, explication courte affichée après réponse, source.

### Parcours (écran 08)
- Chemin vertical des unités et de leurs leçons. Terminer une leçon débloque la suivante ; une unité est « Terminée » quand toutes ses leçons le sont.
- Toutes les leçons sont gratuites.
- En quiz, après « Valider » : correction immédiate avec l'explication (écran 11), lien « Signaler cette question ».
- Fin de leçon (écran 12) : score, pourcentage, XP gagnés, nombre d'erreurs à revoir, leçon suivante débloquée.

### Révision (écrans 13–14)
- **Mes erreurs** : les questions ratées, jusqu'à deux réussites consécutives. Elles sont aussi réinjectées dans les leçons suivantes (au plus 2 par leçon).
- **Révision par thème** : une série de questions tirées d'une unité déjà commencée.
- Une séance de révision compte pour la série de jours et rapporte des XP comme une leçon.

### Série de jours, XP et objectif quotidien
- Un jour compte dès qu'une leçon ou une révision est terminée ce jour-là (fuseau Africa/Lome, date de la séance faisant foi, y compris hors ligne). Remise à zéro après un jour sans séance.
- 10 XP par séance terminée, +5 XP pour un sans-faute (réglables).
- **Objectif quotidien** : 5, 10 ou 15 minutes (choisi à l'accueil, modifiable). Le temps compté est la durée active des séances (leçons, révisions, examens). L'accueil affiche « Objectif du jour x / y min ».
- **Rappel quotidien** : activable, heure choisie par l'élève (19:00 par défaut). Il est envoyé seulement si l'élève n'a pas encore fait de séance ce jour-là. La permission de notification est demandée à l'activation.

### Progrès (écran 19)
- Série en cours, XP total, leçons terminées / total, jours pratiqués de la semaine (L→D), objectif du jour.
- Réussite par thème : pourcentage de bonnes réponses par unité et nombre de réponses.
- Jalons simples, calculés sans table dédiée : première leçon terminée, séries de 3, 7 et 30 jours, premier examen blanc réussi.
- Lien vers l'historique des examens.

### Comptes et profil (écrans 01–07, 21–22, 25, 27)
- Inscription par e-mail + mot de passe, avec acceptation des conditions ; vérification de l'e-mail ; connexion ; mot de passe oublié par lien e-mail ; choix d'un nouveau mot de passe.
- Configuration après inscription : pays (Togo seul actif), type de permis (voiture), prénom (facultatif), objectif quotidien.
- Code promo d'auto-école facultatif, saisi dans le profil ou avant le premier achat ; modifiable jusqu'au premier achat.
- Préférences : prénom, objectif, pays, rappel et son heure. Le fuseau horaire est fixé à Lomé en V1.
- Suppression de compte avec confirmation du mot de passe et case « Je comprends les conséquences » : supprime le compte, la progression et les données personnelles. Les paiements sont conservés, anonymisés, pour la comptabilité et les commissions.

## 5. Examens blancs

- Paramètres portés par le programme : 20 questions, seuil 13, temps par question, répartition par thème exprimée en **nombre de questions par unité** (dont la somme doit égaler le nombre de questions). Sans répartition, le tirage est aléatoire sur tout le programme.
- Écran d'accueil de l'examen (écran 15) : nombre de questions, durée, règles, mention de l'examen gratuit s'il est disponible.
- Déroulé (écran 16, adapté) : une question à la fois, chronomètre par question, bouton « Suivant » seulement (pas de « Précédent »). Temps écoulé = question comptée fausse et passage automatique à la suivante. Chaque réponse est enregistrée sur le serveur dès sa validation.
- Résultat (écran 17) : note /20, Admis/Ajourné, bonnes réponses et erreurs.
- Correction (écran 18) : filtre « Tout / Mes erreurs », réponse donnée, bonne réponse, explication, lien « Signaler la question ».
- Historique (écran 20) : liste des examens avec date et note, courbe des notes, accès à chaque correction.
- **Indicateur « Prêt pour l'examen »** : après 3 examens blancs admis consécutifs (réglable).
- La note est calculée côté serveur. Les bonnes réponses d'un examen ne sont renvoyées qu'après sa soumission.
- Connexion requise. Si la connexion est perdue, l'examen reste reprenable jusqu'à expiration de son temps total ; ensuite il est noté avec les réponses reçues. Relancer un examen déjà ouvert le reprend au lieu d'en créer un nouveau.

## 6. Pass Examen et paiement

### Accès
- 1 examen blanc gratuit par compte (« examen découverte »).
- **Pass Examen** : examens blancs illimités pendant 90 jours, paiement unique, prix réglable. Pas de renouvellement automatique ; rachat possible à l'expiration (la nouvelle période démarre à la fin de la précédente si elle est encore active).
- Les écrans « Premium » du prototype deviennent « Pass Examen » :
  - écran 23 : avantages (examens blancs illimités 90 jours, correction détaillée, indicateur « prêt »), prix, champ code promo, bouton « Payer avec Flooz / T-Money », « Continuer gratuitement » ;
  - écran 24 « Mon Pass » : statut (actif / expiré / aucun), date d'échéance, historique des paiements. Pas de « Restaurer mes achats » : le Pass est lié au compte ;
  - écran 28 : confirmation après paiement confirmé par le serveur.
- Les résultats et l'historique restent accessibles après expiration du Pass.

### Paiement
- Passerelle mobile money supportant Flooz et T-Money. Candidat privilégié : PayGate Global ; alternatives : CinetPay, FedaPay. Choix final après vérification des frais, de l'API et du mode test.
- Flux :
  1. L'application demande à l'API de créer un paiement (statut `pending`, montant calculé côté serveur, réduction éventuelle).
  2. L'API initie la transaction auprès de la passerelle ; l'élève valide sur son téléphone.
  3. La passerelle notifie l'API (webhook). L'API vérifie l'authenticité de la notification et le montant, passe le paiement à `confirmed` et crée ou prolonge le Pass.
  4. L'application affiche « Paiement en cours » tant que le statut est `pending` et interroge l'API jusqu'à confirmation ou échec.
- Le traitement du webhook est idempotent. Un paiement confirmé par la passerelle après avoir été marqué échoué (délai dépassé) est tout de même honoré.
- Les paiements `pending` depuis plus de 30 minutes passent à `failed`.
- Le Pass n'est jamais activé sur la seule déclaration de l'application.

### Code promo
- Donne une réduction à l'élève (pourcentage réglable par auto-école, 10 % par défaut).
- Chaque paiement confirmé enregistre l'auto-école et le montant de commission (taux réglable par auto-école).

## 7. Contenu, qualité et administration

### Numérisation initiale
1. Réception des scans (PDF ou photos).
2. Extraction page par page en un fichier structuré (JSON) : unité, énoncé, choix, bonnes réponses, image recadrée, page source.
3. Les éléments illisibles ou incertains sont marqués `a_verifier` plutôt que devinés.
4. Import en base avec le statut `brouillon` (ou `a_verifier`).
5. Explications et écrans d'explication des leçons proposés quand absents des scans, également en brouillon.

### Circuit de validation
Statuts d'une question : `brouillon` → `en_validation` (« Soumettre à validation ») → `validee`. `a_verifier` signale un doute d'extraction. Une question ne peut être `validee` que si elle a 2 à 8 choix, au moins une bonne réponse, une leçon, une explication et une source. Seules les questions `validee` sont servies aux élèves. Modifier une question validée la renvoie en `en_validation`.

### Signalements (écrans 26 et 32)
- L'élève signale une question depuis la correction : raison (réponse incorrecte, explication peu claire, problème d'image) + commentaire facultatif.
- L'admin les traite : statuts `nouveau` → `en_cours` → `resolu`, note de traitement, lien vers la question.

### Site d'administration (accès réservé aux administrateurs)
- **Tableau de bord** : chiffres clés (élèves, questions par statut, signalements ouverts, ventes du mois).
- **Programmes** (écran 29) : liste par pays et permis, état, nombre de leçons. Seul un programme validé est publié.
- **Contenus** (écran 30) : unités, leçons (écran d'explication), questions ; éditeur avec aperçu élève ; remplacement d'image ; soumission et validation.
- **Examens** (écran 31) : nombre de questions, seuil, temps par question, répartition par thème, contrôles de conformité (banque suffisante pour la répartition).
- **Signalements** (écran 32).
- **Auto-écoles** (à dessiner) : création, code promo, taux de réduction et de commission, activation.
- **Ventes** (à dessiner) : paiements filtrables par auto-école et par mois, total des commissions dues, export CSV.
- **Réglages globaux** : prix et durée du Pass, XP.

## 8. Architecture technique

### Composants
1. **App élève** : React Native (Expo), Android.
2. **Admin** : Next.js, hébergé sur Vercel.
3. **Backend Neon** (région aws-eu-central-1, Francfort) :
   - **Neon Postgres** : toutes les données ; logique métier critique en fonctions SQL (notation, série, tirage d'examen, confirmation de paiement).
   - **Neon Auth** (Better Auth géré) : comptes e-mail + mot de passe, vérification d'e-mail, réinitialisation. Utilisateurs dans le schéma `neon_auth`. SMTP personnalisé en production.
   - **Neon Functions** : l'API de l'application (Hono), le webhook de paiement. Chaque requête élève porte un jeton Neon Auth vérifié via la clé publique (JWKS) avant tout accès aux données.
   - **Function Triggers** (cron) : rappels quotidiens (toutes les 15 minutes, pour les élèves dont l'heure de rappel tombe dans la fenêtre), expiration des paiements en attente.
   - **Neon Object Storage** : images des questions et des leçons.
4. **Notifications** : Expo Push Notifications.

L'application et l'admin n'accèdent jamais directement à la base : l'app passe par l'API, l'admin par ses routes serveur Next.js, qui vérifient toutes deux l'identité et le rôle.

### Modèle de données (tables principales)
- `programs` (pays, permis, statut, paramètres d'examen, répartition par unité)
- `units`, `lessons` (avec contenu de l'écran d'explication), `questions` (statut, source, explication), `choices` (is_correct)
- `profiles` (id de l'utilisateur Neon Auth, prénom, programme, objectif quotidien, rappel activé et heure, jeton push, driving_school_id)
- `sessions_log` : séances (type leçon / erreurs / thème / examen, date, durée active, score, XP) — base de la série, de l'objectif et des progrès
- `session_answers` (réponses d'une séance)
- `question_mastery` (réussites consécutives par élève et question)
- `exam_attempts`, `exam_answers`
- `passes`, `payments`, `driving_schools`
- `question_reports` (signalements)
- `admins`, `settings` (réglages globaux)

### Sécurité
- Vérification du jeton Neon Auth en tête de chaque route de l'API ; l'identifiant de l'élève vient uniquement du jeton.
- Routes admin : utilisateur présent dans `admins`.
- Notation des examens, calcul des montants et activation des Pass uniquement côté serveur.
- Vérification de l'authenticité des webhooks de paiement.
- Limitation du débit sur les routes sensibles (création de paiement, signalements).

### Hors ligne
- Téléchargement du contenu validé du programme et des images, mise à jour incrémentale via un numéro de version du contenu.
- Leçons et révisions jouables hors ligne ; résultats stockés localement puis synchronisés avec un identifiant unique par séance (pas de doublon).
- Examens blancs, paiements et signalements : connexion requise.

### Tests
- Fonctions SQL : tests sur une base Postgres locale (Docker) — notation tout ou rien, seuil 13/20, série (dont hors ligne et changement de jour), révision des erreurs, tirage avec répartition, réduction et commission, idempotence des paiements.
- API : tests d'intégration (jeton absent ou invalide refusé, un élève ne lit jamais les données d'un autre, bonnes réponses d'un examen cachées avant soumission).
- Intégration : flux de paiement complet en mode test de la passerelle, webhook idempotent.
- Une branche Neon dédiée sert de préproduction.

## 9. Écarts assumés par rapport au prototype

| Écran | Prototype | Décision |
| --- | --- | --- |
| 16 | Chrono global, bouton « Précédent » | Chrono par question, pas de retour en arrière |
| 15, 16, 17, 31 | Examen de démonstration à 10 questions / 10 min | Format officiel : 20 questions, seuil 13, réglable par programme |
| 23, 24, 28, profil | « DriveLearn Premium », abonnement, restauration d'achats | « Pass Examen » 90 jours, paiement unique, lié au compte |
| 23 | Premium donne « toutes les leçons » | Les leçons sont gratuites |
| 12 | « Leçon : +5 XP » | 10 XP par séance, +5 pour un sans-faute |
| 31 | « Type de réponse : Choix unique » au niveau de l'examen | Le type dépend de chaque question |
| — | Pas d'écran auto-écoles ni ventes dans l'admin | Écrans à ajouter |

## 10. Points ouverts

- **Droits sur les questions** : à clarifier avant commercialisation.
- **Temps officiel par question** : à confirmer.
- **Prix du Pass Examen** : à fixer (réglable).
- **Choix de la passerelle de paiement** : à confirmer après vérification (PayGate Global privilégiée).
- **Fournisseur SMTP** pour les e-mails de Neon Auth en production.
