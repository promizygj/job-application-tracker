"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { companyColor } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { dayKey, formatDayKey, formatTime } from "@/lib/time";
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
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS = 3; // per day cell; the rest show as "+N"
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
            {g.key === today && <span className="ml-2 rounded bg-brand-600 px-1.5 py-0.5 text-white normal-case">Today</span>}
          </h2>
          <ul className="divide-y divide-line-subtle card">
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
        action={<button onClick={onSchedule} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Schedule an interview</button>}
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
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line bg-white px-3 py-2 disabled:opacity-40">‹ {when === "past" ? "Newer" : "Earlier"}</button>
          <span className="text-ink-2">{page} / {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-line bg-white px-3 py-2 disabled:opacity-40">{when === "past" ? "Older" : "Later"} ›</button>
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
  const dayPanel = useRef(null);
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

  const selectDay = (d) => {
    setSelected(d);
    if (!d.startsWith(month)) setMonth(d.slice(0, 7));
    // Bring that day's interviews into view (they're listed under the calendar).
    if (byDay[d]?.length) requestAnimationFrame(() => dayPanel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="space-y-4">
      <section aria-label={`Calendar, ${monthLabel}`} className="card overflow-hidden p-1.5 sm:p-0">
        <div className="mb-2 flex items-center justify-between px-1 sm:mb-0 sm:px-4 sm:py-3">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded px-2 py-1 hover:bg-subtle">‹</button>
          <h2 className="font-medium">{monthLabel}</h2>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded px-2 py-1 hover:bg-subtle">›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-3 sm:border-t sm:border-line-subtle" aria-hidden>
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 sm:pt-2 sm:pb-0 sm:text-[11px] sm:tracking-wide sm:uppercase">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-7 ${isLoading ? "opacity-50" : ""}`}>
          {days.map((d, index) => {
            const items = byDay[d] ?? [];
            const count = items.length;
            const inMonth = d.startsWith(month);
            const isSelected = d === selectedDay;
            const isToday = d === today;
            const shown = items.slice(0, MAX_EVENTS);
            const summary = items.map((i) => `${i.application?.company} at ${formatTime(i.startsAt, viewerTz)}`).join("; ");
            const lastCol = index % 7 === 6;
            const lastRow = index >= 35;
            return (
              <button
                key={d}
                onClick={() => selectDay(d)}
                aria-pressed={isSelected}
                aria-label={`${formatDayKey(d, { weekday: "long", year: "numeric" })}${count ? `, ${count} interview${count > 1 ? "s" : ""}: ${summary}` : ""}`}
                className={[
                  "flex min-h-24 min-w-0 flex-col gap-0.5 border-line-subtle px-0.5 pt-1 pb-1.5 text-left",
                  // Phones: rows separated by a line. Wider: a full grid like Google Calendar's month view.
                  "border-t sm:min-h-28 sm:border-t-0 sm:px-1.5 sm:pt-1.5",
                  lastCol ? "" : "sm:border-r",
                  lastRow ? "" : "sm:border-b",
                  isSelected
                    ? "rounded-lg border-transparent bg-brand-50/60 ring-2 ring-brand-600 ring-inset sm:rounded-none sm:border-line-subtle sm:bg-brand-50/70 sm:ring-0"
                    : "hover:bg-subtle",
                  inMonth ? "" : "opacity-45",
                ].join(" ")}
              >
                <span
                  className={`mx-auto mb-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold sm:mb-1 sm:text-sm ${
                    isToday ? "bg-brand-600 text-white" : isSelected ? "sm:bg-brand-100 sm:text-brand-800" : "text-ink"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                {shown.map((i) => {
                  const color = companyColor(i.application?.company);
                  return (
                    <span key={i.id} aria-hidden title={`${formatTime(i.startsAt, viewerTz)} ${i.application?.company} · ${i.title}`} className="min-w-0">
                      {/* Phones: colour bar + name wrapping onto 2 lines (Google Calendar app) */}
                      <span className="flex min-w-0 gap-[3px] sm:hidden">
                        <span className="w-[3px] shrink-0 rounded-full" style={{ background: color }} />
                        <span className="line-clamp-2 min-w-0 text-[10px] leading-[13px] font-medium break-all text-ink">{i.application?.company}</span>
                      </span>
                      {/* Wider screens: dot, "2pm", bold name, on one line (Google Calendar month view) */}
                      <span className="hidden min-w-0 items-center gap-1.5 rounded px-1 text-xs leading-[18px] text-ink sm:flex">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                        <span className="min-w-0 truncate">
                          <span className="text-ink-2">{formatTime(i.startsAt, viewerTz)}</span>{" "}
                          <span className="font-semibold">{i.application?.company}</span>
                        </span>
                      </span>
                    </span>
                  );
                })}
                {count > MAX_EVENTS && (
                  <span aria-hidden className="pl-1 text-[10px] leading-[13px] font-medium text-ink-3 sm:pl-1 sm:text-xs sm:leading-[18px] sm:font-semibold sm:text-ink-2">
                    <span className="sm:hidden">+{count - MAX_EVENTS}</span>
                    <span className="hidden sm:inline">{count - MAX_EVENTS} more</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section ref={dayPanel} aria-labelledby="selected-day" className="scroll-mt-4">
        <h2 id="selected-day" className="mb-2 font-medium">{formatDayKey(selectedDay, { weekday: "long", year: "numeric" })}</h2>
        {byDay[selectedDay]?.length ? (
          <ul className="divide-y divide-line-subtle card">
            {byDay[selectedDay].map((i) => (
              <InterviewItem key={i.id} interview={i} application={i.application} viewerTz={viewerTz} now={now} onEdit={onEdit} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">No interviews on this day.</p>
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
        <h1 className="text-h1 font-semibold text-ink">Interviews</h1>
        <button onClick={onSchedule} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Schedule interview
        </button>
      </div>

      <div role="tablist" aria-label="Interview views" className="flex gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="tab"
            aria-selected={view === v.value}
            onClick={() => setParams({ view: v.value, page: null })}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink aria-selected:border-brand-600 aria-selected:text-brand-700"
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
