import { redirect } from "next/navigation";
import { AuthShell, Brand, buttonClass } from "@/components/ui";
import { auth } from "@/lib/auth/server";

async function signOut() {
  "use server";
  await auth.signOut();
  redirect("/auth/sign-in");
}

export default function RefusePage() {
  return (
    <AuthShell action={signOut}>
      <Brand />
      <h1 className="text-center text-xl font-black text-nuit">Accès réservé</h1>
      <p className="text-center text-gris">Ce compte n'est pas administrateur de DriveLearn.</p>
      <button className={buttonClass("secondary")}>Se déconnecter</button>
    </AuthShell>
  );
}
