// Petits éléments partagés par les pages (composants serveur).

export const QUESTION_STATUS: Record<string, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  en_validation: "En validation",
  validee: "Validée",
};
export const PROGRAM_STATUS: Record<string, string> = { brouillon: "Brouillon", en_validation: "En validation", publie: "Publié" };
export const REPORT_STATUS: Record<string, string> = { nouveau: "Nouveau", en_cours: "En cours", resolu: "Résolu" };
export const REPORT_REASON: Record<string, string> = {
  reponse_incorrecte: "Réponse incorrecte",
  explication_peu_claire: "Explication peu claire",
  probleme_image: "Problème d'image",
};
export const PAYMENT_STATUS: Record<string, string> = { pending: "En attente", confirmed: "Payé", failed: "Échoué" };

export function Badge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <span className={`badge b-${status}`}>{labels[status] ?? status}</span>;
}

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Message de retour d'une action (?ok=… ou ?error=…). */
export async function Flash({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  if (typeof sp.error === "string") return <div className="alert error">{sp.error}</div>;
  if (typeof sp.ok === "string") return <div className="alert ok">{sp.ok}</div>;
  return null;
}

export function fcfa(n: number | null | undefined): string {
  return `${String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

export function date(value: string | Date | null, withTime = false): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    timeZone: "Africa/Lome",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
