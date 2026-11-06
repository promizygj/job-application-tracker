"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Toaster } from "@/components/Toaster";
import { Icon } from "@/components/ui/Icon";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { useGetMeQuery } from "@/store/apiSlice";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/applications", label: "Applications", icon: "briefcase" },
  { href: "/board", label: "Board", icon: "kanban" },
  { href: "/interviews", label: "Interviews", icon: "calendar" },
  { href: "/documents", label: "Documents", icon: "file" },
];

const navLinkClass =
  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm leading-5 font-medium text-ink-2 hover:bg-subtle hover:text-ink aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 [&>span:first-child]:text-slate-500 aria-[current=page]:[&>span:first-child]:text-brand-600";

const initialsOf = (name) => name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "…";

function Avatar({ name }) {
  return (
    <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
      {initialsOf(name)?.[0] ?? "…"}
    </span>
  );
}

function Sidebar({ onNavigate }) {
  const pathname = usePathname();
  const { data: user } = useGetMeQuery();

  return (
    <div className="flex h-full flex-col gap-1 px-4 pt-5 pb-4">
      <Link href="/dashboard" onClick={onNavigate} className="mb-5 block pl-2">
        <Logo />
      </Link>
      <p className="pb-1.5 pl-3 text-caps font-semibold text-ink-3 uppercase">Menu</p>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            className={navLinkClass}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <Link
        href="/settings/profile"
        onClick={onNavigate}
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        className={`mt-2 ${navLinkClass}`}
      >
        <Icon name="settings" />
        Settings
      </Link>
      <div className="h-px bg-line" />
      <div className="flex items-center gap-2.5 pt-3 pr-1 pl-2">
        <Avatar name={user?.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-5 font-semibold text-ink">{user?.name}</p>
          <p className="truncate text-xs leading-4 text-ink-3">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut({ redirectTo: "/login" })}
          aria-label="Log out"
          title="Log out"
          className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-subtle hover:text-ink"
        >
          <Icon name="logout" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Top-bar search: jumps to the Applications list filtered by the text. */
function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef(null);

  // ⌘K / Ctrl+K focuses the search.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit(e) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q").trim();
    router.push(q ? `/applications?q=${encodeURIComponent(q)}` : "/applications");
    e.currentTarget.reset();
    inputRef.current?.blur();
  }

  return (
    <form role="search" onSubmit={submit} className="relative hidden w-full max-w-[380px] sm:block">
      <label htmlFor="global-search" className="sr-only">Search</label>
      <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        id="global-search"
        name="q"
        type="search"
        placeholder="Search companies, roles…"
        className="h-10 w-full rounded-lg border border-transparent bg-subtle pr-12 pl-[38px] text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand-600 focus:bg-white focus:ring-[3px] focus:ring-brand-100"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 font-sans text-xs leading-4 font-medium text-ink-3">
        ⌘K
      </kbd>
    </form>
  );
}

function UserMenu() {
  const { data: user } = useGetMeQuery();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={user?.name ? `${user.name}, account menu` : "Account menu"}
        className="flex items-center gap-2.5 rounded-full py-0.5 pr-1 pl-0.5 hover:bg-subtle"
      >
        <Avatar name={user?.name} />
        <span className="hidden text-sm font-medium text-ink sm:inline">{user?.name?.split(" ")[0]}</span>
        <Icon name="chevronDown" size={16} className="text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-pop">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-ink-3">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-line-subtle" />
          <Link
            role="menuitem"
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink"
          >
            <Icon name="settings" size={16} />
            Settings
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut({ redirectTo: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-2 hover:bg-subtle hover:text-ink"
          >
            <Icon name="logout" size={16} />
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
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-white lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-64 bg-white shadow-pop">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-8">
        <button className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-subtle lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Icon name="list" />
        </button>
        <GlobalSearch />
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <VerifyEmailBanner />
        {children}
      </main>
      <Toaster />
    </div>
  );
}
