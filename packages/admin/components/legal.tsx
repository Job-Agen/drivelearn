import type { ReactNode } from "react";

// Éléments des pages publiques (confidentialité, conditions, suppression de compte).

export const CONTACT_EMAIL = "drivelearn75@gmail.com";
export const UPDATED = "24 octobre 2026";

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="mb-1 text-[30px] leading-tight font-black text-nuit">{children}</h1>;
}
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-2 text-xl font-extrabold text-nuit">{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mb-3">{children}</p>;
}
export function Ul({ children }: { children: ReactNode }) {
  return <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>;
}
export function Updated() {
  return <p className="mb-6 text-sm text-gris">Dernière mise à jour : {UPDATED}</p>;
}
