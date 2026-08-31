"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LeagueTabs({
  leagueId,
  isCommissioner,
}: {
  leagueId: string;
  isCommissioner: boolean;
}) {
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;
  const tabs = [
    { href: base, label: "Standings" },
    { href: `${base}/roster`, label: "My Team" },
    { href: `${base}/pickem`, label: "Pick'em" },
    ...(isCommissioner ? [{ href: `${base}/admin`, label: "Commissioner" }] : []),
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((tab) => {
        const active =
          tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-ember-600 text-ember-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
