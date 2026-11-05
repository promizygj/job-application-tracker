import { EMPLOYMENT_TYPES, STATUS, labelOf } from "@/lib/constants";

export function StatusBadge({ status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s?.badge ?? ""}`}>
      {s?.label ?? status}
    </span>
  );
}

export function Tag({ children }) {
  return <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{children}</span>;
}

export const EmploymentTypeTag = ({ type }) => <Tag>{labelOf(EMPLOYMENT_TYPES, type)}</Tag>;
