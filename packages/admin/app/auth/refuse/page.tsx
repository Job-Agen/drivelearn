import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

async function signOut() {
  "use server";
  await auth.signOut();
  redirect("/auth/sign-in");
}

export default function RefusePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow">
        <h1 className="text-xl font-bold text-nuit">Accès réservé</h1>
        <p className="text-sm text-slate-600">Ce compte n'est pas administrateur de DriveLearn.</p>
        <form action={signOut}>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Se déconnecter</button>
        </form>
      </div>
    </main>
  );
}
