"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Toaster } from "@/components/Toaster";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { useGetMeQuery } from "@/store/apiSlice";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▣" },
  { href: "/applications", label: "Applications", icon: "☰" },
  { href: "/board", label: "Board", icon: "▥" },
  { href: "/interviews", label: "Interviews", icon: "◷" },
  { href: "/documents", label: "Documents", icon: "▤" },
];

const navLinkClass =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-700";

function NavLinks({ onNavigate }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
      {NAV.map((item) =>
        item.soon ? (
          <span key={item.href} aria-disabled className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400">
            <span aria-hidden>{item.icon}</span>
            {item.label}
            <span className="ml-auto rounded bg-slate-100 px-1.5 text-xs">Soon</span>
          </span>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-700"
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ),
      )}
      <Link
        href="/settings/profile"
        onClick={onNavigate}
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        className={`mt-auto border-t border-slate-100 pt-3 ${navLinkClass}`}
      >
        <span aria-hidden>⚙</span>
        Settings
      </Link>
    </nav>
  );
}

function UserMenu() {
  const { data: user } = useGetMeQuery();
  const [open, setOpen] = useState(false);
  const initials = user?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "…";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-slate-100"
      >
        <span className="grid size-8 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{initials}</span>
        <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-slate-500">{user?.email}</p>
          <Link role="menuitem" href="/settings/profile" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm hover:bg-slate-100">
            Settings
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut({ redirectTo: "/login" })}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <Link href="/dashboard" className="mb-6 block px-3"><Logo /></Link>
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-white p-4 shadow-xl">
            <div className="mb-6 px-3"><Logo /></div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button className="rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
        <div className="ml-auto"><UserMenu /></div>
      </header>

      <VerifyEmailBanner />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      <Toaster />
    </div>
  );
}
