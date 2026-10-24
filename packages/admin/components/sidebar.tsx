"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "./nav-link";

/**
 * Menu de l'administration. Ordinateur : barre latérale fixe. Téléphone : bandeau compact (logo, page en cours,
 * bouton « Menu ») qui déplie la liste des pages et se referme après chaque navigation.
 */
export function Sidebar({ items, footer }: { items: { href: string; label: string; count?: number }[]; footer: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const current = items.find((i) => (i.href === "/" ? path === "/" : path.startsWith(i.href)));
  const alerts = items.reduce((n, i) => n + (i.count ?? 0), 0);

  return (
    <aside className="sticky top-0 z-20 flex shrink-0 flex-col bg-nuit text-white md:h-screen md:w-60 md:gap-1 md:px-[14px] md:py-5">
      <div className="flex items-center gap-3 px-4 py-3 md:px-2.5 md:pt-1 md:pb-[18px]">
        <p className="text-2xl font-black tracking-tight">
          Drive<span className="text-[#5fd3cb]">Learn</span>
        </p>
        <span className="min-w-0 flex-1 truncate text-right font-bold text-[#dbe6ff] md:hidden">{current?.label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="menu-admin"
          className="relative rounded-full border border-white/30 px-3 py-1.5 text-sm font-extrabold md:hidden"
        >
          {open ? "Fermer" : "Menu"}
          {!open && alerts > 0 && <span className="absolute -top-1 -right-1 size-3 rounded-full bg-rouge" aria-hidden />}
        </button>
      </div>
      <div id="menu-admin" className={`${open ? "flex" : "hidden"} flex-col gap-1 px-[14px] pb-4 md:flex md:flex-1 md:p-0`}>
        <nav className="flex flex-col gap-0.5">
          {items.map((i) => (
            <NavLink key={i.href} {...i} />
          ))}
        </nav>
        {footer}
      </div>
    </aside>
  );
}
