# DriveLearn — dossier Play Store

Tout ce qu'il faut pour remplir la Google Play Console. Les textes sont prêts à copier-coller.

## Paiement du Pass Examen : vendu hors de l'application

Google Play impose son propre système de paiement pour les contenus numériques achetés **dans** une application.
Choix retenu : **l'app ne vend rien**. Le Pass Examen s'obtient sous forme de **code d'activation** (site
d'administration → « Codes Pass »), vendu par les auto-écoles partenaires ou en direct ; l'élève le saisit dans
l'app (écran Pass Examen → « Activer mon Pass »).

À respecter dans l'app, la fiche et les captures : **aucun prix, aucun lien ni aucune indication pour acheter le
Pass ailleurs** (Google l'interdit). L'app dit seulement « Saisis le code de ton Pass Examen ». Le paiement
Flooz / T-Money reste dans le code, désactivé (`PASS_SALES_IN_APP` dans `packages/app/src/lib/config.ts`).

## Fiche de l'application

| Champ | Contenu |
| --- | --- |
| Nom (30 car. max) | DriveLearn – Code de la route |
| Catégorie | Enseignement |
| Langue par défaut | Français (France) – fr-FR |
| E-mail de contact | drivelearn75@gmail.com |
| Politique de confidentialité | https://drivelearn-admin.vercel.app/confidentialite |
| Suppression du compte | https://drivelearn-admin.vercel.app/suppression-compte |
| Identifiant du paquet | tg.drivelearn.app (définitif après la première publication) |

**Description courte (80 car. max)**

> Révise le code de la route du Togo : leçons courtes, quiz et examens blancs.

**Description complète**

> DriveLearn t'accompagne jusqu'à l'examen du code de la route, quelques minutes par jour.
>
> 📚 Des leçons courtes et claires
> Les panneaux, les priorités, la signalisation, les intersections : chaque leçon tient en quelques minutes, avec
> un mentor qui t'explique l'essentiel.
>
> ✅ Des quiz pour retenir
> Après chaque leçon, réponds aux questions et découvre l'explication de chaque réponse. Tes erreurs reviennent
> automatiquement dans la révision jusqu'à ce que tu les maîtrises.
>
> 🔥 Un peu chaque jour
> Choisis ton objectif (5, 10 ou 15 minutes), garde ta série de jours et reçois un rappel à l'heure qui te convient.
>
> 📝 Des examens blancs comme le vrai
> Entraîne-toi dans les conditions de l'examen : questions chronométrées, note finale et correction
> détaillée. Ton premier examen blanc est offert.
>
> 📶 Même sans connexion
> Les leçons sont enregistrées sur ton téléphone : révise partout, tes résultats sont envoyés dès que tu retrouves
> du réseau.
>
> 🔑 Pass Examen
> Tu as un code d'activation du Pass Examen ? Saisis-le dans l'app pour débloquer tous les examens blancs.
>
> DriveLearn ne remplace pas ton auto-école : c'est le compagnon de révision qui t'aide à arriver prêt le jour de
> l'examen.

## Visuels

| Visuel | Fichier | Exigence Google |
| --- | --- | --- |
| Icône | `play-icon-512.png` | 512 × 512, PNG |
| Image de présentation | `feature-graphic-1024x500.png` | 1024 × 500 |
| Captures d'écran téléphone | à faire depuis l'app installée | 2 à 8, format portrait |

Captures conseillées, une fois le programme publié : accueil, parcours (onglet Apprendre), une question avec
explication, la révision des erreurs, les progrès, un résultat d'examen blanc.

Les icônes et l'image de présentation se régénèrent avec `outils/generer-visuels.py`.

## Sécurité des données (formulaire « Data safety »)

**L'application collecte-t-elle ou partage-t-elle des données ?** Oui, elle en collecte. Elle n'en partage pas
(Neon, qui héberge les données pour notre compte, ne compte pas comme un partage).

**Toutes les données sont chiffrées en transit** : oui. **Les utilisateurs peuvent demander la suppression** : oui
(dans l'app et via la page de suppression).

| Type de données (catégorie Google) | Collectée | Obligatoire | Finalité | Éphémère |
| --- | --- | --- | --- | --- |
| Adresse e-mail (Infos personnelles) | Oui | Oui | Gestion du compte | Non |
| Nom (Infos personnelles) — le prénom | Oui | Non | Fonctionnement de l'app | Non |
| Interactions avec l'app (Activité dans l'app) — séances, réponses | Oui | Oui | Fonctionnement de l'app, personnalisation | Non |
| Autre contenu généré par l'utilisateur — commentaires de signalement | Oui | Non | Fonctionnement de l'app | Non |

Rien d'autre : pas de position, pas de contacts, pas de photos, pas d'identifiant d'appareil, pas de journaux de
plantage, pas de publicité, pas d'achat dans l'app.

## Autres rubriques de la Play Console

- **Accès à l'application** : l'app demande une connexion. Créer un compte de test dans l'app, avec
  une adresse e-mail que tu contrôles (utile si la vérification d'e-mail est activée plus tard), choisir le programme, et donner ses identifiants à Google.
- **Annonces** : l'application ne contient pas d'annonces.
- **Classification du contenu** (questionnaire IARC) : catégorie « Référence, actualités ou éducation » ; aucune
  violence, aucun contenu sexuel, pas de jeux d'argent, pas d'échanges entre utilisateurs, pas de partage de
  position ; achats numériques : **non** (le Pass est activé par un code obtenu hors de l'app).
- **Public cible** : 16-17 ans et 18 ans et plus (pas de moins de 13 ans : évite les obligations « Familles »).
- **Application d'actualités / santé / finance** : non.

## Fabrication pour le Play Store

Dans GitHub : onglet **Actions** → « Application Android » → **Run workflow** → profil **production**. Le fichier
`.aab` se télécharge depuis la page de la fabrication sur expo.dev, puis s'envoie dans la Play Console
(Production → Créer une release). Le numéro de version augmente tout seul à chaque fabrication « production ».

Pour un premier envoi, commencer par un **test interne** (quelques testeurs, publication en quelques minutes)
avant la production. Les nouveaux comptes développeur personnels doivent en général faire un **test fermé**
avec des testeurs pendant plusieurs jours avant de pouvoir publier en production : la Play Console l'indique.
