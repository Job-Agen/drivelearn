import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  // Tout sauf les pages de connexion, l'API d'authentification et les fichiers statiques.
  matcher: ["/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
