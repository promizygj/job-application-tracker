import { SALARY_PERIODS } from "./constants";

/** Date-only values (e.g. appliedAt) are stored at 00:00 UTC: format them in UTC so the day never shifts. */
export function formatDate(iso, opts = {}) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...opts }).format(new Date(iso));
}

export function formatDateTime(iso, timeZone) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone && { timeZone }),
  }).format(new Date(iso));
}

function money(amount, currency) {
  const opts = { notation: "compact", maximumFractionDigits: 1 };
  try {
    return new Intl.NumberFormat("en", currency ? { ...opts, style: "currency", currency, currencyDisplay: "narrowSymbol" } : opts).format(amount);
  } catch {
    return new Intl.NumberFormat("en", opts).format(amount);
  }
}

/**
 * "€70K–€90K / yr", "From $50K", "Up to £40K", or null.
 * `compact` (cards and tables): "€70K – €90K" without the period.
 */
export function formatSalary({ salaryMin, salaryMax, salaryCurrency, salaryPeriod }, { compact = false } = {}) {
  if (salaryMin == null && salaryMax == null) return null;
  const period = SALARY_PERIODS.find((p) => p.value === salaryPeriod)?.short;
  const suffix = period && !compact ? ` / ${period}` : "";
  if (salaryMin != null && salaryMax != null) {
    return salaryMin === salaryMax
      ? `${money(salaryMin, salaryCurrency)}${suffix}`
      : `${money(salaryMin, salaryCurrency)}${compact ? " – " : "–"}${money(salaryMax, salaryCurrency)}${suffix}`;
  }
  return salaryMin != null ? `From ${money(salaryMin, salaryCurrency)}${suffix}` : `Up to ${money(salaryMax, salaryCurrency)}${suffix}`;
}

export function percent(rate) {
  return rate == null ? "—" : `${Math.round(rate * 1000) / 10}%`;
}
