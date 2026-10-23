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
        Les leçons et les révisions sont gratuites. Le Pass Examen donne accès aux examens blancs pendant la durée
        indiquée dans l'application au moment de l'achat. Son prix est affiché avant le paiement ; il se paie une seule
        fois, par Flooz ou T-Money, et ne se renouvelle pas automatiquement. Un code promo d'auto-école partenaire peut
        donner une réduction.
      </P>
      <P>
        Si un paiement a été débité sans que le Pass soit activé, écrivez-nous à {CONTACT_EMAIL} avec la date et le
        numéro utilisé : nous vérifions auprès du prestataire de paiement et activons le Pass ou vous remboursons.
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
