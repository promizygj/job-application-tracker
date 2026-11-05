import Link from "next/link";

/**
 * Horizontal bars in plain HTML: one baseline on the left, ≤ 12px thick, 4px rounded data end,
 * value printed at the tip (every value is visible text, so nothing hides behind a tooltip).
 * items: [{ key, label, value, color, href?, note? }]
 */
export function BarList({ items, label }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  // Room kept at the end of the longest bar for its value (and note, when the list has notes).
  const reserve = items.some((i) => i.note) ? "8rem" : "2.5rem";
  return (
    <ul aria-label={label} className="space-y-1">
      {items.map((item) => {
        const row = (
          <>
            <span className="w-24 shrink-0 truncate text-sm text-slate-700">{item.label}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {item.value > 0 && (
                <span
                  aria-hidden
                  className="h-3 rounded-r-[4px]"
                  // Leave room for the value at the tip.
                  style={{ width: `calc((100% - ${reserve}) * ${item.value / max})`, background: item.color }}
                />
              )}
              <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">{item.value}</span>
              {item.note && <span className="truncate text-xs text-slate-500">{item.note}</span>}
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                href={item.href}
                aria-label={`${item.label}: ${item.value}${item.note ? `, ${item.note}` : ""}`}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                {row}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-2 py-1.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
