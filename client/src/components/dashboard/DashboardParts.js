"use client";

import Link from "next/link";
import { CompanyLogo, StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { MoreMenu } from "@/components/ui/MoreMenu";
import { INTERVIEW_TYPES, labelOf } from "@/lib/constants";
import { formatDate, formatSalary } from "@/lib/format";

export function Card({ className = "", children }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base leading-6 font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-xs leading-4 text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ViewAll({ href, children = "View all" }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-xs leading-4 font-medium text-brand-600 hover:underline">
      {children}
      <Icon name="chevronRight" size={14} />
    </Link>
  );
}

// ───────────── Stat card ─────────────

const CHIP = {
  brand: "bg-brand-50 text-brand-600",
  amber: "bg-amber-100 text-amber-600",
  green: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
};
const DELTA = { brand: "text-emerald-700", amber: "text-amber-700", green: "text-emerald-700", blue: "text-emerald-700" };

/** Figma StatCard: label + icon chip, 30px number, small coloured supporting line. */
export function StatCard({ label, value, icon, tone = "brand", hint, hintIcon = "trendingUp" }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm leading-5 font-medium text-ink-2">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${CHIP[tone]}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className="text-stat font-semibold text-ink tabular-nums">{value}</p>
      {hint && (
        <p className={`flex items-center gap-1.5 text-xs leading-4 font-medium ${DELTA[tone]}`}>
          <Icon name={hintIcon} size={14} />
          {hint}
        </p>
      )}
    </div>
  );
}

// ───────────── Interviews ─────────────

function zoned(iso, timeZone, opts) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(new Date(iso));
}

/** Date chip + "Company · Role", round, time and place (Figma InterviewItem). */
export function InterviewCard({ interview, timeZone }) {
  const place = interview.meetingUrl ? labelOf(INTERVIEW_TYPES, interview.type) : interview.location || labelOf(INTERVIEW_TYPES, interview.type);
  return (
    <Link
      href={`/applications/${interview.application.id}`}
      className="flex gap-3.5 rounded-[10px] border border-line p-3.5 hover:border-brand-200 hover:bg-brand-50/40"
    >
      <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-line-subtle bg-canvas py-1.5">
        <span className="text-[11px] leading-4 font-semibold text-brand-600 uppercase">{zoned(interview.startsAt, timeZone, { month: "short" })}</span>
        <span className="text-xl leading-7 font-semibold text-brand-700">{zoned(interview.startsAt, timeZone, { day: "2-digit" })}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold text-ink">
          {interview.application.company} · {interview.application.jobTitle}
        </span>
        <span className="block truncate text-xs leading-4 text-ink-2">{interview.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-4 text-ink-2">
          <span className="flex items-center gap-1">
            <Icon name="clock" size={12} className="text-ink-3" />
            {zoned(interview.startsAt, timeZone, { hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <Icon name={interview.meetingUrl || interview.type === "VIDEO" ? "video" : "mapPin"} size={12} className="text-ink-3" />
            <span className="truncate">{place}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}

// ───────────── Applications table ─────────────

const where = (a) => [a.location, a.employmentType && { REMOTE: "Remote", HYBRID: "Hybrid", ONSITE: "On-site" }[a.employmentType]].filter(Boolean).join(" · ");

/** Figma TableHeader + TableRow/Application. Each row links to the application. */
export function ApplicationsTable({ items, caption }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-y border-line bg-canvas">
          <tr className="text-caps font-semibold text-ink-3 uppercase">
            <th scope="col" className="h-10 px-5 font-semibold">Company &amp; role</th>
            <th scope="col" className="w-[150px] px-2 font-semibold">Status</th>
            <th scope="col" className="w-[190px] px-2 font-semibold">Location</th>
            <th scope="col" className="w-[150px] px-2 font-semibold">Salary</th>
            <th scope="col" className="w-[110px] px-2 font-semibold">Applied</th>
            <th scope="col" className="w-12 px-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="group relative border-b border-line-subtle last:border-b-0 hover:bg-brand-50/50">
              <td className="h-[68px] px-5">
                <div className="flex items-center gap-3">
                  <CompanyLogo name={a.company} />
                  <div className="min-w-0">
                    {/* The link covers the whole row so the row is clickable but stays one tab stop. */}
                    <Link
                      href={`/applications/${a.id}`}
                      className="block truncate leading-5 font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none group-has-focus-visible:underline"
                    >
                      {a.company}
                    </Link>
                    <p className="truncate text-xs leading-4 text-ink-2">{a.jobTitle}</p>
                  </div>
                </div>
              </td>
              <td className="px-2"><StatusBadge status={a.status} /></td>
              <td className="px-2 text-ink-2">
                {where(a) ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="mapPin" size={14} className="text-ink-3" />
                    <span className="truncate">{where(a)}</span>
                  </span>
                ) : "—"}
              </td>
              <td className="px-2 whitespace-nowrap text-ink-2">{formatSalary(a, { compact: true }) ?? "—"}</td>
              <td className="px-2 whitespace-nowrap text-ink-2">{a.appliedAt ? formatDate(a.appliedAt, { year: undefined }) : "—"}</td>
              <td className="px-2 text-right">
                <MoreMenu
                  label={`More for ${a.company}`}
                  items={[
                    { href: `/applications/${a.id}`, label: "Open" },
                    { href: `/applications/${a.id}/edit`, label: "Edit details" },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
