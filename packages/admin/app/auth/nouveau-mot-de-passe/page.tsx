import { ResetForm } from "./form";

/** Ouverte depuis le lien reçu par e-mail (…/auth/nouveau-mot-de-passe?token=…). */
export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === "string" ? token : ""} />;
}
