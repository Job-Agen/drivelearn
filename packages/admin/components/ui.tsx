import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-bleu focus:outline-none";
export const tableClass = "w-full text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-slate-500";

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-nuit">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {title && <h2 className="mb-4 font-semibold text-nuit">{title}</h2>}
      {children}
    </section>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (ok) return <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{ok}</p>;
  return null;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
}) {
  const styles = {
    primary: "bg-sarcelle text-white hover:opacity-90",
    secondary: "border border-slate-300 bg-white text-nuit hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  }[variant];
  return (
    <button type="submit" name={name} value={value} className={`rounded-lg px-4 py-2 text-sm font-semibold ${styles}`}>
      {children}
    </button>
  );
}

const STATUS_LABELS: Record<string, [string, string]> = {
  brouillon: ["Brouillon", "bg-slate-100 text-slate-700"],
  a_verifier: ["À vérifier", "bg-amber-100 text-amber-800"],
  en_validation: ["En validation", "bg-blue-100 text-blue-800"],
  validee: ["Validée", "bg-emerald-100 text-emerald-800"],
  publie: ["Publié", "bg-emerald-100 text-emerald-800"],
  nouveau: ["Nouveau", "bg-blue-100 text-blue-800"],
  en_cours: ["En cours", "bg-amber-100 text-amber-800"],
  resolu: ["Résolu", "bg-emerald-100 text-emerald-800"],
  pending: ["En attente", "bg-amber-100 text-amber-800"],
  confirmed: ["Confirmé", "bg-emerald-100 text-emerald-800"],
  failed: ["Échoué", "bg-red-100 text-red-700"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, style] = STATUS_LABELS[status] ?? [status, "bg-slate-100 text-slate-700"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}
