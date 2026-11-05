"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { dayKey, formatDayKey } from "@/lib/time";
import { useGetMeQuery, useListInterviewsQuery } from "@/store/apiSlice";
import { InterviewDialog } from "./InterviewDialog";
import { InterviewItem } from "./InterviewItem";

const VIEWS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "calendar", label: "Calendar" },
];
const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Interviews grouped under day headings (in the viewer's time zone). */
function Agenda({ items, viewerTz, now, onEdit }) {
  const groups = [];
  for (const i of items) {
    const key = dayKey(i.startsAt, viewerTz);
    if (groups.at(-1)?.key !== key) groups.push({ key, items: [] });
    groups.at(-1).items.push(i);
  }
  const today = dayKey(new Date(now).toISOString(), viewerTz);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`day-${g.key}`}>
          <h2 id={`day-${g.key}`} className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {formatDayKey(g.key, { year: "numeric" })}
            {g.key === today && <span className="ml-2 rounded bg-indigo-600 px-1.5 py-0.5 text-white normal-case">Today</span>}
          </h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {g.items.map((i) => (
              <InterviewItem key={i.id} interview={i} application={i.application} viewerTz={viewerTz} now={now} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ListView({ when, page, setPage, viewerTz, now, onEdit, onSchedule }) {
  const { data, isLoading, isError, refetch, isFetching } = useListInterviewsQuery({ when, page, limit: PAGE_SIZE });
  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Couldn't load your interviews." onRetry={refetch} />;
  if (data.items.length === 0) {
    return when === "upcoming" ? (
      <EmptyState
        title="No upcoming interviews"
        action={<button onClick={onSchedule} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Schedule an interview</button>}
      >
        When you schedule one, it shows up here with the meeting link and your prep notes.
      </EmptyState>
    ) : (
      <EmptyState title="No past interviews yet">Interviews move here once their start time has passed, so you can record how they went.</EmptyState>
    );
  }
  const { meta } = data;
  return (
    <div className={`space-y-4 ${isFetching ? "opacity-60" : ""}`}>
      <Agenda items={data.items} viewerTz={viewerTz} now={now} onEdit={onEdit} />
      {meta.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-40">‹ {when === "past" ? "Newer" : "Earlier"}</button>
          <span className="text-slate-600">{page} / {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-40">{when === "past" ? "Older" : "Later"} ›</button>
        </nav>
      )}
    </div>
  );
}

function CalendarView({ month, setMonth, viewerTz, now, onEdit }) {
  const today = dayKey(new Date(now).toISOString(), viewerTz);
  const first = `${month}-01`;
  const firstDow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const gridStart = addDays(first, -firstDow);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Pad a day each side so time-zone differences at the grid edges don't drop interviews.
  const { data, isLoading, isError, refetch } = useListInterviewsQuery({ from: addDays(gridStart, -1), to: addDays(days.at(-1), 1), limit: 100 });
  const [selected, setSelected] = useState(today.startsWith(month) ? today : first);
  const selectedDay = selected.startsWith(month) ? selected : first;

  const byDay = useMemo(() => {
    const map = {};
    for (const i of data?.items ?? []) (map[dayKey(i.startsAt, viewerTz)] ??= []).push(i);
    return map;
  }, [data, viewerTz]);

  const shiftMonth = (n) => {
    const d = new Date(`${first}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T00:00:00Z`));

  if (isError) return <ErrorState message="Couldn't load your calendar." onRetry={refetch} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-label={`Calendar, ${monthLabel}`} className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded px-2 py-1 hover:bg-slate-100">‹</button>
          <h2 className="font-medium">{monthLabel}</h2>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded px-2 py-1 hover:bg-slate-100">›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-slate-500" aria-hidden>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${isLoading ? "opacity-50" : ""}`}>
          {days.map((d) => {
            const count = byDay[d]?.length ?? 0;
            const inMonth = d.startsWith(month);
            return (
              <button
                key={d}
                onClick={() => {
                  setSelected(d);
                  if (!inMonth) setMonth(d.slice(0, 7));
                }}
                aria-pressed={d === selectedDay}
                aria-label={`${formatDayKey(d, { weekday: "long", year: "numeric" })}${count ? `, ${count} interview${count > 1 ? "s" : ""}` : ""}`}
                className={`flex aspect-square flex-col items-center justify-start rounded-md p-1 text-sm sm:aspect-auto sm:h-16 ${
                  d === selectedDay ? "bg-indigo-600 text-white" : inMonth ? "hover:bg-slate-100" : "text-slate-400 hover:bg-slate-50"
                }`}
              >
                <span className={d === today && d !== selectedDay ? "font-bold text-indigo-600" : ""}>{Number(d.slice(8))}</span>
                {count > 0 && (
                  <span className={`mt-1 rounded-full px-1.5 text-[10px] font-semibold ${d === selectedDay ? "bg-white text-indigo-700" : "bg-violet-100 text-violet-700"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="selected-day">
        <h2 id="selected-day" className="mb-2 font-medium">{formatDayKey(selectedDay, { weekday: "long", year: "numeric" })}</h2>
        {byDay[selectedDay]?.length ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {byDay[selectedDay].map((i) => (
              <InterviewItem key={i.id} interview={i} application={i.application} viewerTz={viewerTz} now={now} onEdit={onEdit} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No interviews on this day.</p>
        )}
      </section>
    </div>
  );
}

export function InterviewsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isError: meError, refetch: refetchMe } = useGetMeQuery();
  const [now] = useState(() => Date.now());
  const [dialog, setDialog] = useState(null); // { interview? } when open

  const setParams = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "" || (k === "view" && v === "upcoming") || (k === "page" && v === 1)) next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onEdit = (interview) => setDialog({ interview });
  const onSchedule = () => setDialog({});

  // Everything below depends on the user's time zone and the current time. Render it only once the
  // profile has loaded in the browser, so the server-rendered HTML never disagrees with the client.
  if (!me) return meError ? <ErrorState message="Couldn't load your profile." onRetry={refetchMe} /> : <Spinner />;
  const viewerTz = me.timezone;
  const view = VIEWS.some((v) => v.value === params.get("view")) ? params.get("view") : "upcoming";
  const page = Number(params.get("page")) || 1;
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month") : dayKey(new Date(now).toISOString(), viewerTz).slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Interviews</h1>
        <button onClick={onSchedule} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + Schedule interview
        </button>
      </div>

      <div role="tablist" aria-label="Interview views" className="flex gap-1 border-b border-slate-200">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="tab"
            aria-selected={view === v.value}
            onClick={() => setParams({ view: v.value, page: null })}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 aria-selected:border-indigo-600 aria-selected:text-indigo-700"
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Times shown in {viewerTz.replace(/_/g, " ")} (your profile time zone).</p>

      <div role="tabpanel" aria-label={VIEWS.find((v) => v.value === view).label}>
        {view === "calendar" ? (
          <CalendarView month={month} setMonth={(m) => setParams({ month: m })} viewerTz={viewerTz} now={now} onEdit={onEdit} />
        ) : (
          <ListView
            key={view}
            when={view}
            page={page}
            setPage={(p) => setParams({ page: p })}
            viewerTz={viewerTz}
            now={now}
            onEdit={onEdit}
            onSchedule={onSchedule}
          />
        )}
      </div>

      <InterviewDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        interview={dialog?.interview}
        application={dialog?.interview?.application}
      />
    </div>
  );
}
