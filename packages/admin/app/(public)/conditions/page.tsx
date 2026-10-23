import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, H1, H2, P, Ul, Updated } from "@/components/legal";

export const metadata: Metadata = { title: "Conditions d'utilisation · DriveLearn" };

export default function TermsPage() {
  return (
    <>
      <H1>Conditions d'utilisation</H1>
      <Updated />
      <P>En créant un compte DriveLearn, vous acceptez les conditions ci-dessous.</P>

      <H2>Le service</H2>
      <P>
        DriveLearn aide à réviser le code de la route avec des leçons, des quiz et des examens blancs. Les contenus sont
        préparés à partir des cours de code et vérifiés par notre équipe, mais DriveLearn ne remplace ni une auto-école
        ni les textes officiels, et ne garantit pas la réussite à l'examen.
      </P>

      <H2>Votre compte</H2>
      <Ul>
        <li>Un compte est personnel : gardez votre mot de passe pour vous.</li>
        <li>Les informations que vous donnez doivent être exactes.</li>
        <li>
          Vous pouvez supprimer votre compte à tout moment (voir{" "}
          <Link className="font-bold text-bleu" href="/suppression-compte">Supprimer mon compte</Link>).
        </li>
      </Ul>

      <H2>Gratuit et Pass Examen</H2>
      <P>
        Les leçons et les révisions sont gratuites, ainsi que le premier examen blanc. Le Pass Examen donne accès aux
        examens blancs pendant une durée fixe (90 jours sauf mention contraire au moment de la vente). Il s'active en
        saisissant dans l'application un code d'activation, utilisable une seule fois. Il ne se renouvelle pas
        automatiquement ; un nouveau code prolonge le Pass en cours.
      </P>
      <P>
        Si un code d'activation est refusé alors que vous ne l'avez jamais utilisé, écrivez-nous à {CONTACT_EMAIL} avec
        le code et l'endroit où vous l'avez obtenu : nous le vérifions et activons votre Pass.
      </P>

      <H2>Bon usage</H2>
      <P>
        Il est interdit de copier ou revendre les contenus de DriveLearn, ou de tenter de perturber le service. Nous
        pouvons suspendre un compte qui ne respecte pas ces règles.
      </P>

      <H2>Erreurs dans les contenus</H2>
      <P>
        Si une question vous paraît fausse ou peu claire, utilisez le lien « Signaler cette question » de l'application : chaque
        signalement est relu et la question corrigée si nécessaire.
      </P>

      <H2>Données personnelles</H2>
      <P>
        Leur utilisation est décrite dans la{" "}
        <Link className="font-bold text-bleu" href="/confidentialite">politique de confidentialité</Link>.
      </P>

      <H2>Modifications et contact</H2>
      <P>
        Ces conditions peuvent évoluer ; la version en vigueur est toujours publiée sur cette page. Pour toute question :{" "}
        {CONTACT_EMAIL}.
      </P>
    </>
  );
}
