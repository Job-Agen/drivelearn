import Link from "next/link";
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-[10px] border-[1.5px] border-bord bg-white px-3 py-2 text-[15px] text-texte focus:border-bleu-vif focus:outline-2 focus:outline-bleu-doux";
export const tableClass =
  "w-full text-left text-sm [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5";
export const linkClass = "font-bold text-bleu hover:underline";

const BUTTON = {
  primary: "bg-sarcelle text-white hover:bg-sarcelle-fonce",
  secondary: "border-[1.5px] border-[#b9d7f5] bg-white text-bleu hover:bg-bleu-doux",
  danger: "border-[1.5px] border-rouge bg-white text-rouge hover:bg-rouge-doux",
} as const;
type Variant = keyof typeof BUTTON;

export function buttonClass(variant: Variant = "primary", small = false) {
  return `inline-flex items-center justify-center gap-1.5 rounded-full font-extrabold whitespace-nowrap disabled:opacity-50 ${
    small ? "px-3 py-1 text-[13px]" : "px-[18px] py-2 text-[15px]"
  } ${BUTTON[variant]}`;
}

export function PageTitle({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: string; back?: [string, string]; actions?: ReactNode }) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back[0]} className="mb-1 block text-[13px] font-bold text-bleu">
            ← {back[1]}
          </Link>
        )}
        <h1 className="text-[28px] leading-tight font-black text-nuit">{title}</h1>
        {subtitle && <p className="mt-1 text-gris">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-4 rounded-[14px] border border-bord bg-white p-[18px] ${className}`}>
      {title && <h2 className="mb-3 text-[19px] font-extrabold text-nuit">{title}</h2>}
      {children}
    </section>
  );
}

/** Chiffre clé du tableau de bord ou des ventes. */
export function Stat({ value, label, hint, href }: { value: ReactNode; label: string; hint?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-[14px] border border-bord bg-white p-[18px] transition hover:border-[#b9d7f5]">
      <p className="text-[30px] leading-tight font-black text-nuit">{value}</p>
      <p className="font-bold text-gris">{label}</p>
      {hint && <p className="text-[13px] text-gris">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="mb-4 rounded-xl bg-rouge-doux px-[14px] py-3 font-bold text-rouge">{error}</p>;
  if (ok) return <p className="mb-4 rounded-xl bg-sarcelle-doux px-[14px] py-3 font-bold text-sarcelle-fonce">{ok}</p>;
  return null;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[5px] block font-bold text-nuit">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-gris">{hint}</span>}
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  small,
  name,
  value,
}: {
  children: ReactNode;
  variant?: Variant;
  small?: boolean;
  name?: string;
  value?: string;
}) {
  return (
    <button type="submit" name={name} value={value} className={buttonClass(variant, small)}>
      {children}
    </button>
  );
}

const STATUS_LABELS: Record<string, [string, string]> = {
  brouillon: ["Brouillon", "bg-[#eef1f5] text-gris"],
  a_verifier: ["À vérifier", "bg-ambre-doux text-ambre"],
  en_validation: ["En validation", "bg-bleu-doux text-bleu"],
  validee: ["Validée", "bg-sarcelle-doux text-sarcelle-fonce"],
  publie: ["Publié", "bg-sarcelle-doux text-sarcelle-fonce"],
  nouveau: ["Nouveau", "bg-[#eef1f5] text-gris"],
  en_cours: ["En cours", "bg-ambre-doux text-ambre"],
  resolu: ["Résolu", "bg-sarcelle-doux text-sarcelle-fonce"],
  pending: ["En attente", "bg-[#eef1f5] text-gris"],
  confirmed: ["Payé", "bg-sarcelle-doux text-sarcelle-fonce"],
  failed: ["Échoué", "bg-rouge-doux text-rouge"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, style] = STATUS_LABELS[status] ?? [status, "bg-[#eef1f5] text-gris"];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap ${style}`}>{label}</span>;
}

/** Cadre des pages de connexion : fond bleu, carte blanche centrée. */
export function AuthShell({ children, action }: { children: ReactNode; action?: (formData: FormData) => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-linear-160 from-[#1258b8] to-[#2e7fe0] p-5">
      <form action={action} className="flex w-[380px] max-w-full flex-col gap-[14px] rounded-[14px] border border-bord bg-white p-7">
        {children}
      </form>
    </main>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center">
      <p className="text-[30px] font-black text-nuit">
        Drive<span className="text-sarcelle">Learn</span>
      </p>
      {subtitle && <p className="text-gris">{subtitle}</p>}
    </div>
  );
}
