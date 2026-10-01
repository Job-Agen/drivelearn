"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signUpWithEmail(_prev: { error: string } | null, formData: FormData) {
  const { error } = await auth.signUp.email({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: error.message || "Création du compte impossible." };
  redirect("/");
}
