# DriveLearn — Design (V1)

Date : 2026-09-27
Statut : validé en conversation, en attente de relecture du document

## 1. Objectif

DriveLearn est une application Android d'apprentissage du code de la route togolais, au fonctionnement inspiré de Duolingo. L'élève progresse par courtes leçons dans un parcours ludique, puis s'entraîne avec des examens blancs conformes à l'examen officiel.

- **Marché** : Togo, interface en français.
- **Utilisateur payant** : l'élève, par mobile money (Flooz, T-Money).
- **Auto-écoles** : canal de distribution. Elles diffusent un code promo et touchent une commission sur les ventes associées.
- **Critère de succès V1** : un élève peut s'inscrire, suivre le parcours gratuit, acheter un Pass Examen et passer des examens blancs notés comme l'examen officiel ; l'administrateur peut valider le contenu et calculer les commissions dues.

## 2. Périmètre

### Inclus en V1
- Parcours de leçons à débloquer (unités → leçons → questions)
- Série de jours (streak) + notification de rappel quotidienne
- XP + classement hebdomadaire global
- Examens blancs (1 gratuit, puis Pass Examen payant)
- Paiement mobile money via passerelle
- Codes promo d'auto-écoles avec réduction et suivi des commissions
- Site d'administration (contenu, réglages, auto-écoles, ventes)
- Numérisation initiale du contenu à partir des scans fournis

### Exclu de V1
iOS, espace auto-école (tableau de bord, suivi des élèves), ligues/divisions, cœurs (vies), mascotte/animations élaborées, abonnement récurrent, gel de série.

## 3. Règles de l'examen officiel (Togo)

- 20 questions, notées sur 20 (1 point par question).
- Admis si note ≥ 13/20, ajourné sinon.
- Une question peut avoir une ou plusieurs bonnes réponses, avec jusqu'à 8 choix proposés.
- Notation **tout ou rien** : la question vaut 1 seulement si l'ensemble des choix cochés est exactement l'ensemble des bonnes réponses ; sinon 0.
- Ces règles s'appliquent aux leçons comme aux examens blancs.
- Le temps par question est un réglage administrateur (valeur officielle à confirmer).

## 4. Parcours et leçons

### Structure du contenu
- **Unité** : grand thème (ex. panneaux de danger, priorités, stationnement, croisements et dépassements, mécanique et secours), ordonné.
- **Leçon** : groupe d'environ 8 questions d'une unité (nombre réglable), de difficulté croissante.
- **Question** : énoncé, image optionnelle, 2 à 8 choix, une ou plusieurs bonnes réponses, explication courte affichée après réponse.

### Parcours
- Chemin vertical de leçons. Terminer une leçon débloque la suivante.
- Toutes les leçons sont gratuites.
- Fin de leçon : score, XP gagnés, récapitulatif des erreurs.
- **Révision des erreurs** : une question ratée est réinjectée dans les leçons suivantes jusqu'à deux réussites consécutives.

### Série de jours
- Un jour compte dès qu'une leçon est terminée ce jour-là (fuseau Africa/Lome, date de la leçon faisant foi, y compris hors ligne).
- Remise à zéro après un jour sans leçon.
- Rappel par notification à 19 h aux élèves n'ayant pas encore révisé dans la journée.

### XP et classement
- 10 XP par leçon terminée, +5 XP pour un sans-faute (valeurs réglables).
- Classement hebdomadaire global, remis à zéro le lundi 00:00 (Africa/Lome).
- Affichage sous pseudo choisi par l'élève (par défaut : prénom + initiale du nom).

### Comptes
- Inscription et connexion par numéro de téléphone + code SMS (OTP).
- Code promo d'auto-école facultatif à l'inscription, modifiable jusqu'au premier achat.

## 5. Examens blancs et paiement

### Examen blanc
- Paramètres depuis `settings` : 20 questions, seuil 13, temps par question.
- Tirage aléatoire parmi les questions validées, avec répartition par unité selon des poids réglables (par défaut proportionnelle au nombre de questions par unité).
- Chronomètre par question, sans retour en arrière. Temps écoulé = question comptée fausse.
- La note est calculée côté serveur à partir des réponses envoyées.
- Résultat : note /20, Admis/Ajourné, correction détaillée avec explications, temps total.
- **Indicateur « Prêt pour l'examen »** : affiché après 3 examens blancs admis consécutifs (réglable).
- Connexion requise.

### Accès
- 1 examen blanc gratuit par compte.
- **Pass Examen** : examens blancs illimités pendant 90 jours, paiement unique, prix réglable. Pas de renouvellement automatique ; rachat possible à l'expiration (la nouvelle période démarre à la fin de la précédente si elle est encore active).

### Paiement
- Passerelle mobile money supportant Flooz et T-Money. Candidat privilégié : PayGate Global ; alternatives : CinetPay, FedaPay. Choix final après vérification des frais, de l'API et du mode test.
- Flux :
  1. L'application demande au serveur de créer un paiement (`payments`, statut `pending`, montant calculé côté serveur avec la réduction éventuelle).
  2. Le serveur initie la transaction auprès de la passerelle ; l'élève valide sur son téléphone.
  3. La passerelle notifie le serveur (webhook). Le serveur vérifie l'authenticité de la notification et le montant, passe le paiement à `confirmed` et crée/prolonge le `pass`.
  4. L'application affiche « Paiement en cours » tant que le statut est `pending`, et interroge le serveur jusqu'à confirmation ou échec.
- Le traitement du webhook est idempotent (une même notification reçue deux fois n'active pas deux pass).
- Le Pass n'est jamais activé sur la seule déclaration de l'application.

### Code promo
- Donne une réduction à l'élève (pourcentage réglable par auto-école, 10 % par défaut).
- Chaque paiement confirmé enregistre l'auto-école et le montant de commission (taux réglable par auto-école).

## 6. Numérisation du contenu et administration

### Numérisation initiale
1. Réception des scans (PDF ou photos).
2. Extraction page par page en un fichier structuré (JSON) : unité, énoncé, choix, bonnes réponses, image recadrée, page source.
3. Les éléments illisibles ou incertains sont marqués `a_verifier` plutôt que devinés.
4. Import en base avec le statut `brouillon`.
5. Explications proposées quand absentes des scans, également en brouillon.

### Site d'administration (Next.js, accès réservé aux administrateurs)
- **Questions** : liste filtrable (unité, statut), édition, remplacement d'image, explication, validation. Seules les questions `validee` sont servies aux élèves.
- **Unités et leçons** : ordre des unités, taille des leçons.
- **Réglages** : nombre de questions d'examen, seuil, temps par question, prix et durée du Pass, XP, seuil « Prêt pour l'examen ».
- **Auto-écoles** : création, code promo, taux de réduction, taux de commission, activation/désactivation.
- **Ventes** : liste des paiements filtrable par auto-école et par mois, total des commissions dues, export CSV.

## 7. Architecture technique

### Composants
1. **App élève** : React Native (Expo), Android.
2. **Admin** : Next.js.
3. **Backend** : Supabase — PostgreSQL, Auth (OTP téléphone), Storage (images), Edge Functions (paiement, webhook, notation d'examen), tâche planifiée (rappels, remise à zéro du classement).
4. **Notifications** : Expo Push Notifications.

### Modèle de données (tables principales)
- `units`, `lessons`, `questions` (statut : brouillon / a_verifier / validee), `choices` (is_correct)
- `profiles` (pseudo, téléphone, streak courant, dernier jour actif, XP total, driving_school_id, push token)
- `lesson_attempts`, `answers` (base de la révision des erreurs)
- `question_mastery` (compteur de réussites consécutives par élève et question)
- `weekly_xp` (élève, semaine, XP)
- `exam_attempts` (questions tirées, réponses, note, admis, durées)
- `passes` (élève, début, fin), `payments` (montant, réduction, statut, référence passerelle, driving_school_id, commission)
- `driving_schools` (nom, code promo, taux de réduction, taux de commission, actif)
- `settings` (clé/valeur)
- Rôle administrateur via une table ou un claim dédié.

### Sécurité
- Row Level Security sur toutes les tables : un élève ne lit et n'écrit que ses propres données ; le contenu validé est en lecture seule ; l'admin a accès complet.
- Notation des examens, calcul des montants et activation des pass uniquement côté serveur.
- Les bonnes réponses d'un examen blanc ne sont pas envoyées à l'application avant la soumission.
- Vérification de l'authenticité des webhooks de paiement.

### Hors ligne
- Téléchargement du contenu validé et des images, mise à jour incrémentale via un numéro de version du contenu.
- Leçons jouables hors ligne ; résultats stockés localement puis synchronisés (streak calculé sur la date locale de la leçon).
- Examens blancs et paiements : connexion requise.

### Gestion des erreurs
- Paiement : statuts `pending` / `confirmed` / `failed` ; délai d'expiration des paiements `pending` ; message clair à l'élève à chaque état.
- Synchronisation : renvoi automatique des résultats en attente, sans doublon (identifiant unique par tentative).
- Perte de connexion pendant un examen : l'examen reste reprenable jusqu'à expiration de son temps total, sinon il est noté avec les réponses reçues.

### Tests
- Unitaires : notation tout ou rien, seuil 13/20, calcul du streak (dont hors ligne et changement de jour), révision des erreurs, calcul réduction/commission.
- Base de données : règles RLS (un élève ne peut pas lire les données d'un autre ni les bonnes réponses d'un examen en cours).
- Intégration : flux de paiement complet en mode test de la passerelle, webhook idempotent.

## 8. Points ouverts

- **Droits sur les questions** : à clarifier avant commercialisation (propriété des scans ou licence de l'éditeur).
- **Temps officiel par question** : à confirmer.
- **Prix du Pass Examen** : à fixer (réglable).
- **Choix de la passerelle de paiement** : à confirmer après vérification (PayGate Global privilégiée).
