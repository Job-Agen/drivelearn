"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, count }: { href: string; label: string; count?: number }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link href={href} className={active ? "active" : undefined}>
      {label}
      {count ? <span className="count">{count}</span> : null}
    </Link>
  );
}
