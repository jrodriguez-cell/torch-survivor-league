"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function GroupTabs({
  groupId,
  isCommish,
}: {
  groupId: string;
  isCommish: boolean;
}) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/pick`, label: "Make a Pick" },
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/history`, label: "My History" },
    ...(isCommish
      ? [
          { href: `${base}/scoring`, label: "Scoring" },
          { href: `${base}/settings`, label: "Settings" },
        ]
      : []),
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
