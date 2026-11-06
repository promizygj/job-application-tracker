"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CompanyLogo, Pill } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

const COPY = {
  "/register": {
    title: "Start tracking your job applications today.",
    text: "Free to use. Add your first application in under a minute.",
  },
  "/verify-email": {
    title: "One quick step and you’re in.",
    text: "Verifying your email keeps your account secure and unlocks document uploads.",
  },
  default: {
    title: "Every job you apply for, in one place.",
    text: "Track applications, interviews and outcomes without the spreadsheet chaos.",
  },
};

// Illustration only: a sample of what the dashboard looks like.
const SAMPLE = [
  { company: "Paystack", role: "Product Designer", label: "Interview", badge: "bg-amber-100 text-amber-700", dot: "#f59e0b" },
  { company: "Flutterwave", role: "Senior UI Designer", label: "Applied", badge: "bg-blue-50 text-blue-700", dot: "#3b82f6" },
  { company: "Carbon", role: "Product Designer", label: "Offer", badge: "bg-emerald-100 text-emerald-700", dot: "#10b981" },
];

const FEATURES = [
  "Log every application in seconds",
  "See upcoming interviews at a glance",
  "Keep résumés and cover letters together",
  "Know your response and offer rates",
];

export function BrandPanel() {
  const pathname = usePathname();
  const copy = COPY[pathname] ?? COPY.default;

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[43%] max-w-[620px] shrink-0 flex-col overflow-y-auto px-14 pt-12 pb-10 lg:flex"
      style={{ backgroundImage: "linear-gradient(129deg, #7c3aed 0%, #4c1d95 71.4%)" }}
    >
      <Link href="/" className="self-start">
        <Logo tone="light" />
      </Link>
      <div className="flex-1" />

      <p className="text-[40px] leading-12 font-semibold tracking-[-0.8px] text-white">{copy.title}</p>
      <p className="mt-3.5 text-base leading-6 text-white/80">{copy.text}</p>

      <div aria-hidden className="mt-9 rounded-[14px] bg-white px-[18px] pt-4 pb-2 shadow-[0_12px_32px_-8px_rgba(15,23,41,0.1)]">
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm font-semibold text-ink">Recent applications</p>
          <p className="text-xs font-medium text-ink-3">This week</p>
        </div>
        {SAMPLE.map((s, i) => (
          <div key={s.company} className={`flex items-center gap-3 py-2.5 ${i < SAMPLE.length - 1 ? "border-b border-line-subtle" : ""}`}>
            <CompanyLogo name={s.company} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-semibold text-ink">{s.company}</p>
              <p className="text-xs leading-4 text-ink-2">{s.role}</p>
            </div>
            <Pill className={s.badge} dot={s.dot}>{s.label}</Pill>
          </div>
        ))}
      </div>

      <ul className="mt-8 space-y-3.5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-3 text-sm leading-5 font-medium text-white/95">
            <span className="grid size-[22px] place-items-center rounded-full bg-white/[0.18]">
              <Icon name="check" size={13} className="text-white" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className="flex-1" />
      <p className="mt-10 text-xs leading-4 text-white/60">© JobTrack</p>
    </aside>
  );
}
