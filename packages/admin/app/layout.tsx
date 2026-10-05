import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

// Nunito, comme dans l'application élève (fichiers inclus : rien à télécharger au build).
const nunito = localFont({
  src: [
    { path: "./fonts/Nunito_400Regular.ttf", weight: "400" },
    { path: "./fonts/Nunito_600SemiBold.ttf", weight: "600" },
    { path: "./fonts/Nunito_700Bold.ttf", weight: "700" },
    { path: "./fonts/Nunito_800ExtraBold.ttf", weight: "800" },
    { path: "./fonts/Nunito_900Black.ttf", weight: "900" },
  ],
  variable: "--font-nunito",
});

export const metadata: Metadata = { title: "DriveLearn Admin", robots: { index: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
