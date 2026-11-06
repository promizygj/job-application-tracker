import { EMPLOYMENT_TYPES, STATUS, labelOf } from "@/lib/constants";

/** Pill with a 6px dot (Figma StatusBadge). */
export function Pill({ className = "", dot, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs leading-4 font-medium whitespace-nowrap ${className}`}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status];
  return <Pill className={s?.badge ?? "bg-slate-100 text-ink-2"} dot={s?.dot ?? "#94a3b8"}>{s?.label ?? status}</Pill>;
}

/** Grey meta chip (location, salary, skills…). */
export function Tag({ icon, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-[3px] text-xs leading-4 text-ink-2 ${className}`}>
      {icon}
      {children}
    </span>
  );
}

export const EmploymentTypeTag = ({ type }) => <Tag>{labelOf(EMPLOYMENT_TYPES, type)}</Tag>;

// Company avatars: initials on a colour picked from the company name, so each company keeps its colour.
const AVATAR_COLORS = ["#0ba4db", "#f5a623", "#0057ff", "#3b0764", "#0f9d58", "#635bff", "#e11d48", "#06b6d4", "#1e1b4b", "#65a30d", "#ea580c", "#7c3aed"];

export function initials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

function colorFor(name = "") {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Figma CompanyLogo: md = 40px, sm = 32px, lg = 56px. */
export function CompanyLogo({ name, size = "md", className = "" }) {
  const sizes = { sm: "size-8 rounded-lg text-xs font-medium", md: "size-10 rounded-[10px] text-sm font-semibold", lg: "size-14 rounded-xl text-base font-semibold" };
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center text-white ${sizes[size]} ${className}`} style={{ background: colorFor(name) }}>
      {initials(name)}
    </span>
  );
}
