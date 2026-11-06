"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const TABS = [
  { href: "/settings/profile", label: "Profile", icon: "user" },
  { href: "/settings/security", label: "Account & security", icon: "settings" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:self-start">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
          className="flex h-9 items-center gap-2.5 rounded-lg border border-transparent px-3 text-sm font-medium whitespace-nowrap text-ink-2 hover:bg-white hover:text-ink aria-[current=page]:border-line aria-[current=page]:bg-white aria-[current=page]:text-ink aria-[current=page]:shadow-card"
        >
          <Icon name={t.icon} size={16} className="text-ink-3" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
