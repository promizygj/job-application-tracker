"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayKey } from "@/lib/time";
import { VIZ } from "@/lib/vizTokens";

const SERIES = [
  { key: "applied", name: "Applications sent", color: VIZ.series[0] },
  { key: "interviews", name: "Interviews", color: VIZ.series[1] },
];
const shortWeek = (key) => formatDayKey(key, { weekday: undefined });

/** Hover/focus readout: one tooltip with every series for the week. Values lead, names follow. */
function WeekTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 text-slate-500">Week of {formatDayKey(label, { weekday: undefined, year: "numeric" })}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2 py-0.5">
          <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
          <strong className="text-sm font-semibold text-slate-900">{row[s.key]}</strong>
          <span className="text-slate-600">{s.name}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Applications sent and interviews per week (same unit, one axis). Grouped thin columns with a
 * legend, a week-wide hover band + tooltip, and a table view as the accessible twin.
 */
export function ActivityChart({ weeks }) {
  const [showTable, setShowTable] = useState(false);
  const totals = SERIES.map((s) => ({ ...s, total: weeks.reduce((n, w) => n + w[s.key], 0) }));
  const summary = `${totals[0].total} applications sent and ${totals[1].total} interviews in the last ${weeks.length} weeks`;

  return (
    <figure className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Legend: rect swatches mirror the bar marks; text stays in text colours. */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
          {totals.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name} <span className="font-semibold text-slate-900">{s.total}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((t) => !t)}
          aria-pressed={showTable}
          className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{summary}</caption>
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-1 font-medium">Week of</th>
                {SERIES.map((s) => <th key={s.key} scope="col" className="py-1 text-right font-medium">{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {weeks.map((w) => (
                <tr key={w.weekStart}>
                  <th scope="row" className="py-1 font-normal text-slate-700">{shortWeek(w.weekStart)}</th>
                  {SERIES.map((s) => <td key={s.key} className="py-1 text-right">{w[s.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Fixed height includes the x-axis band, so the card never scrolls.
        <div className="mt-3 h-60" role="img" aria-label={`Bar chart: ${summary}. Use “Show table” for each week's numbers.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke={VIZ.grid} />
              <XAxis
                dataKey="weekStart"
                tickFormatter={shortWeek}
                tickLine={false}
                axisLine={{ stroke: VIZ.axis }}
                tick={{ fill: VIZ.muted, fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: VIZ.muted, fontSize: 12 }} width={40} />
              <Tooltip content={<WeekTooltip />} cursor={{ fill: VIZ.hoverBand }} isAnimationActive={false} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
