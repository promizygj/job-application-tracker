// Labels and colours shared by every page. Colour is always paired with the text label.
// badge = pill background + text (Figma StatusBadge), dot = the 6px dot and chart/legend colour.

export const STATUSES = [
  { value: "SAVED", label: "Saved", badge: "bg-slate-100 text-ink-2", dot: "#94a3b8" },
  { value: "APPLIED", label: "Applied", badge: "bg-blue-50 text-blue-700", dot: "#3b82f6" },
  { value: "ASSESSMENT", label: "Assessment", badge: "bg-brand-50 text-brand-700", dot: "#8b5cf6" },
  { value: "INTERVIEW", label: "Interview", badge: "bg-amber-100 text-amber-700", dot: "#f59e0b" },
  { value: "OFFER", label: "Offer", badge: "bg-emerald-100 text-emerald-700", dot: "#10b981" },
  { value: "REJECTED", label: "Rejected", badge: "bg-red-100 text-red-700", dot: "#ef4444" },
  { value: "WITHDRAWN", label: "Withdrawn", badge: "bg-zinc-100 text-zinc-600", dot: "#71717a" },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

export const EMPLOYMENT_TYPES = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
];

export const JOB_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TEMPORARY", label: "Temporary" },
];

export const SALARY_PERIODS = [
  { value: "YEARLY", label: "per year", short: "yr" },
  { value: "MONTHLY", label: "per month", short: "mo" },
  { value: "HOURLY", label: "per hour", short: "hr" },
];

export const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

export const SOURCES = ["LinkedIn", "Indeed", "Company website", "Referral", "Recruiter", "Job board", "Other"];
export const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "INR", "ZAR", "KES", "GHS"];

export const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest added" },
  { value: "createdAt", label: "Oldest added" },
  { value: "-appliedAt", label: "Applied: newest" },
  { value: "appliedAt", label: "Applied: oldest" },
  { value: "-updatedAt", label: "Recently updated" },
  { value: "company", label: "Company A–Z" },
  { value: "-company", label: "Company Z–A" },
  { value: "status", label: "Status (pipeline order)" },
];

export const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? value;

export const INTERVIEW_TYPES = [
  { value: "PHONE", label: "Phone" },
  { value: "VIDEO", label: "Video" },
  { value: "ONSITE", label: "On-site" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "BEHAVIOURAL", label: "Behavioural" },
  { value: "PANEL", label: "Panel" },
  { value: "OTHER", label: "Other" },
];

export const OUTCOMES = [
  { value: "PENDING", label: "Pending", badge: "bg-slate-100 text-ink-2", dot: "#94a3b8" },
  { value: "PASSED", label: "Passed", badge: "bg-emerald-100 text-emerald-700", dot: "#10b981" },
  { value: "FAILED", label: "Not progressed", badge: "bg-red-100 text-red-700", dot: "#ef4444" },
  { value: "CANCELLED", label: "Cancelled", badge: "bg-zinc-100 text-zinc-600", dot: "#71717a" },
];
export const OUTCOME = Object.fromEntries(OUTCOMES.map((o) => [o.value, o]));

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240].map((m) => ({
  value: String(m),
  label: m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`,
}));
