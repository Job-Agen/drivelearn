import type { Metadata } from "next";
import { CONTACT_EMAIL, H1, H2, P, Ul, Updated } from "@/components/legal";

export const metadata: Metadata = { title: "Supprimer mon compte · DriveLearn" };

export default function DeleteAccountPage() {
  return (
    <>
      <H1>Supprimer mon compte DriveLearn</H1>
      <Updated />

      <H2>Depuis l'application</H2>
      <Ul>
        <li>Ouvrez DriveLearn et allez dans l'onglet <b>Profil</b>.</li>
        <li>Touchez <b>Supprimer mon compte</b>.</li>
        <li>Confirmez avec votre mot de passe.</li>
      </Ul>
      <P>La suppression est immédiate et définitive.</P>

      <H2>Sans l'application</H2>
      <P>
        Si vous n'avez plus accès à l'application, écrivez à{" "}
        <a className="font-bold text-bleu" href={`mailto:${CONTACT_EMAIL}?subject=Suppression%20de%20mon%20compte%20DriveLearn`}>
          {CONTACT_EMAIL}
        </a>{" "}
        depuis l'adresse e-mail de votre compte, avec pour objet « Suppression de mon compte DriveLearn ». Nous supprimons
        le compte sous 7 jours et vous le confirmons par e-mail.
      </P>

      <H2>Ce qui est supprimé</H2>
      <Ul>
        <li>Votre compte de connexion (e-mail et mot de passe).</li>
        <li>Votre profil, vos préférences, vos séances, vos réponses, vos examens blancs et votre Pass Examen.</li>
      </Ul>

      <H2>Ce qui est conservé</H2>
      <Ul>
        <li>Les codes d'activation que vous avez utilisés restent marqués comme utilisés, sans lien avec vous.</li>
        <li>Les signalements de questions que vous avez envoyés, sans lien avec vous.</li>
      </Ul>
    </>
  );
}
