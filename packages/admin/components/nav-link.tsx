"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, count }: { href: string; label: string; count?: number }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 font-bold ${
        active ? "bg-white/[.13] text-white" : "text-[#dbe6ff] hover:bg-white/[.08]"
      }`}
    >
      {label}
      {count ? <span className="rounded-full bg-rouge px-2 text-xs font-extrabold text-white">{count}</span> : null}
    </Link>
  );
}
