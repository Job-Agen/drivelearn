"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

/** Premier accès (compte créé sans mot de passe) ou oubli : lien envoyé par Neon Auth. */
export async function requestReset(_prev: { message: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { message: "Adresse e-mail invalide." };
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  // Même réponse que le compte existe ou non : on ne révèle pas les adresses inscrites.
  await auth.requestPasswordReset({ email, redirectTo: `${origin}/auth/nouveau-mot-de-passe` }).catch(() => null);
  return { message: "Si ce compte existe, un lien vient d'être envoyé à cette adresse. Pense à regarder dans les courriers indésirables." };
}

export async function resetPassword(_prev: { error: string } | null, formData: FormData) {
  const newPassword = String(formData.get("password") ?? "");
  if (newPassword.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (newPassword !== String(formData.get("confirm") ?? "")) return { error: "Les deux mots de passe ne sont pas identiques." };
  const { error } = await auth.resetPassword({ newPassword, token: String(formData.get("token") ?? "") });
  if (error) return { error: "Ce lien n'est plus valable. Demande un nouveau lien." };
  redirect("/auth/sign-in?mot-de-passe=ok");
}
