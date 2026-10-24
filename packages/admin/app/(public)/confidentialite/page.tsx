import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, H1, H2, P, Ul, Updated } from "@/components/legal";

export const metadata: Metadata = { title: "Politique de confidentialité · DriveLearn", robots: { index: true } };

export default function PrivacyPage() {
  return (
    <>
      <H1>Politique de confidentialité</H1>
      <Updated />
      <P>
        DriveLearn est une application d'apprentissage du code de la route. Cette page explique quelles données nous
        collectons, pourquoi, avec qui elles sont partagées et comment les supprimer. Pour toute question :{" "}
        <a className="font-bold text-bleu" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </P>

      <H2>Les données que nous collectons</H2>
      <Ul>
        <li><b>Compte</b> : adresse e-mail, mot de passe (enregistré chiffré, jamais lisible) et, si vous le donnez, votre prénom.</li>
        <li><b>Préférences</b> : pays et permis préparés, objectif quotidien, heure du rappel, auto-école (si vous saisissez un code promo).</li>
        <li><b>Progrès</b> : séances, réponses aux questions, examens blancs, série de jours et points d'expérience.</li>
        <li><b>Pass Examen</b> : le code d'activation que vous saisissez, sa date d'utilisation et la période de votre Pass.</li>
        <li><b>Signalements</b> : la question signalée, le motif et le commentaire que vous écrivez.</li>
      </Ul>
      <P>
        Nous ne collectons ni votre position, ni vos contacts, ni vos photos. L'application ne contient aucune publicité
        et n'utilise aucun outil de suivi publicitaire.
      </P>

      <H2>Pourquoi nous les utilisons</H2>
      <Ul>
        <li>Faire fonctionner votre compte et retrouver votre progression sur un autre téléphone.</li>
        <li>Adapter les leçons et les révisions à vos erreurs, calculer votre série et vos résultats aux examens blancs.</li>
        <li>Activer votre Pass Examen quand vous saisissez un code d'activation.</li>
        <li>Corriger les questions signalées.</li>
        <li>Vous envoyer les e-mails nécessaires au compte (vérification, mot de passe oublié).</li>
      </Ul>
      <P>
        Les rappels quotidiens sont programmés sur votre téléphone par l'application elle-même : aucune donnée n'est
        envoyée pour les afficher. Vous pouvez les désactiver dans l'application (Profil → Rappel quotidien) ou dans les
        réglages du téléphone.
      </P>

      <H2>Avec qui elles sont partagées</H2>
      <P>Nous ne vendons pas vos données. Elles sont seulement traitées par les prestataires techniques suivants :</P>
      <Ul>
        <li><b>Neon</b> (Databricks) : hébergement de la base de données, du serveur et des comptes, en Allemagne (Francfort).</li>
        <li><b>Les auto-écoles partenaires</b> ne reçoivent pas vos données.</li>
      </Ul>

      <H2>Combien de temps nous les gardons</H2>
      <P>
        Vos données sont gardées tant que votre compte existe. Quand vous supprimez votre compte, votre profil, vos
        séances, vos réponses, vos examens et votre Pass sont effacés immédiatement. Le code d'activation reste marqué
        comme utilisé, sans lien avec vous, et les signalements de questions sont conservés sans votre nom.
      </P>

      <H2>Vos droits</H2>
      <P>
        Vous pouvez à tout moment consulter et modifier vos informations dans l'application, et supprimer votre compte
        depuis Profil → Supprimer mon compte (voir{" "}
        <Link className="font-bold text-bleu" href="/suppression-compte">Supprimer mon compte</Link>). Pour exercer vos
        autres droits d'accès, de rectification ou d'opposition prévus par la réglementation togolaise sur la protection
        des données personnelles, écrivez-nous à {CONTACT_EMAIL}.
      </P>

      <H2>Sécurité</H2>
      <P>
        Les échanges entre l'application et nos serveurs sont chiffrés (HTTPS). Votre session est gardée dans le
        stockage sécurisé du téléphone. L'accès à l'administration est réservé à l'équipe DriveLearn.
      </P>

      <H2>Mineurs</H2>
      <P>
        DriveLearn s'adresse aux personnes qui préparent l'examen du code de la route. Elle n'est pas destinée aux enfants
        de moins de 13 ans.
      </P>

      <H2>Modifications</H2>
      <P>
        Si cette politique change, la nouvelle version sera publiée sur cette page avec sa date de mise à jour.
      </P>
    </>
  );
}
