"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmploymentTypeTag } from "@/components/ui/Badge";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchBox } from "@/components/ui/SearchBox";
import { ErrorState, Spinner } from "@/components/ui/States";
import { EMPLOYMENT_TYPES, STATUS, STATUSES } from "@/lib/constants";
import { formatDateTime, formatSalary } from "@/lib/format";
import { getApiError, useGetBoardQuery, useGetMeQuery, useMoveApplicationMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

const DAY = 24 * 60 * 60 * 1000;
const COLUMN_PREFIX = "column:";
const columnId = (status) => `${COLUMN_PREFIX}${status}`;
const COLLAPSED_BY_DEFAULT = ["REJECTED", "WITHDRAWN"]; // KAN-5

const PRIORITY_BORDER = { HIGH: "border-l-red-400", MEDIUM: "border-l-amber-300", LOW: "border-l-slate-200" };

/**
 * Whatever is under the pointer wins (a card over its column), so narrow collapsed columns are hit exactly.
 * Keyboard drags have no pointer, so they (and gaps between columns) fall back to the nearest corners.
 */
function collisionDetection(args) {
  const hits = pointerWithin(args);
  if (hits.length) {
    const cards = hits.filter((h) => !String(h.id).startsWith(COLUMN_PREFIX));
    return cards.length ? cards : hits;
  }
  return closestCorners(args);
}

/** Which column holds `id` (a card id or a column id)? */
function findColumn(id, columns) {
  if (typeof id === "string" && id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length);
  return Object.keys(columns).find((status) => columns[status].includes(id));
}

function appliedLabel(appliedAt, today) {
  if (!appliedAt) return null;
  const days = Math.floor((today - Date.parse(appliedAt)) / DAY);
  if (days <= 0) return "Applied today";
  return days === 1 ? "Applied 1 day ago" : `Applied ${days} days ago`;
}

// ───────────────────────── Card ─────────────────────────

function CardBody({ card, today, timeZone, dragHandleProps, onMove, overlay = false }) {
  const salary = formatSalary(card);
  const applied = appliedLabel(card.appliedAt, today);
  const stop = (e) => e.stopPropagation(); // keep clicks/keys inside controls from starting a drag

  return (
    <div
      {...dragHandleProps}
      className={`rounded-md border border-l-4 border-slate-200 bg-white p-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        PRIORITY_BORDER[card.priority]
      } ${overlay ? "cursor-grabbing shadow-lg" : "cursor-grab"}`}
    >
      <Link
        href={`/applications/${card.id}`}
        draggable={false}
        onKeyDown={stop}
        className="block font-medium hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {card.company}
      </Link>
      <p className="text-slate-600">{card.jobTitle}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <EmploymentTypeTag type={card.employmentType} />
        {salary && <span>{salary}</span>}
      </div>
      {(applied || card.nextInterviewAt) && (
        <div className="mt-2 space-y-0.5 text-xs text-slate-500">
          {card.nextInterviewAt && <p className="font-medium text-violet-700">📅 {formatDateTime(card.nextInterviewAt, timeZone)}</p>}
          {applied && <p>{applied}</p>}
        </div>
      )}
      {/* Touch-friendly alternative to dragging */}
      {onMove && (
        <label className="mt-2 flex items-center gap-1 text-xs text-slate-500 md:hidden" onPointerDown={stop} onKeyDown={stop}>
          Move to
          <select
            value={card.status}
            onChange={(e) => onMove(card, e.target.value)}
            className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function SortableCard({ card, today, timeZone, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "opacity-30" : ""}
    >
      <CardBody
        card={card}
        today={today}
        timeZone={timeZone}
        onMove={onMove}
        dragHandleProps={{ ...attributes, ...listeners, "aria-roledescription": "draggable card", "aria-label": `${card.company}, ${card.jobTitle}` }}
      />
    </li>
  );
}

// ───────────────────────── Column ─────────────────────────

function Column({ status, cards, collapsed, onToggle, today, timeZone, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const s = STATUS[status];
  const ring = isOver ? "ring-2 ring-indigo-400" : "";

  if (collapsed) {
    return (
      <section ref={setNodeRef} aria-label={`${s.label} column, ${cards.length} applications, collapsed`} className={`w-12 shrink-0 rounded-lg bg-slate-100 ${ring}`}>
        <button
          onClick={onToggle}
          aria-expanded={false}
          className="flex h-full min-h-64 w-full flex-col items-center gap-3 rounded-lg py-3 text-sm text-slate-600 hover:bg-slate-200/60"
        >
          <span aria-hidden>▸</span>
          <span className="[writing-mode:vertical-rl]">{s.label}</span>
          <span className="rounded-full bg-white px-1.5 text-xs font-medium">{cards.length}</span>
        </button>
      </section>
    );
  }

  return (
    <section aria-label={`${s.label} column, ${cards.length} applications`} className={`flex w-72 shrink-0 flex-col rounded-lg bg-slate-100 ${ring}`}>
      <header className="flex items-center gap-2 px-3 pt-3 pb-1">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>{s.label}</span>
        <span className="text-sm text-slate-500">{cards.length}</span>
        <button onClick={onToggle} aria-expanded aria-label={`Collapse ${s.label}`} className="ml-auto rounded px-1.5 text-slate-500 hover:bg-slate-200">
          ◂
        </button>
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-2">
          {cards.map((card) => <SortableCard key={card.id} card={card} today={today} timeZone={timeZone} onMove={onMove} />)}
          {cards.length === 0 && (
            <li className="rounded-md border-2 border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Drop cards here</li>
          )}
        </ul>
      </SortableContext>
      <Link href={`/applications/new?status=${status}`} className="mx-2 mb-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-200">
        + Add
      </Link>
    </section>
  );
}

// ───────────────────────── Board ─────────────────────────

function useBoardFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const typesParam = params.get("employmentType") ?? "";
  const types = useMemo(() => typesParam.split(",").filter(Boolean), [typesParam]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      const str = Array.isArray(v) ? v.join(",") : v;
      if (str) next.set(k, str);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const boardArgs = useMemo(() => ({ ...(q && { q }), ...(typesParam && { employmentType: typesParam }) }), [q, typesParam]);
  return { q, types, update, boardArgs };
}

export function BoardView() {
  const { q, types, update, boardArgs } = useBoardFilters();
  const { data: serverColumns, isLoading, isError, refetch } = useGetBoardQuery(boardArgs);
  const { data: me } = useGetMeQuery(); // interview times are shown in the profile time zone
  const [moveApplication] = useMoveApplicationMutation();
  const toast = useToast();
  const [today] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(() => new Set(COLLAPSED_BY_DEFAULT));
  // While dragging we keep our own copy of the card order so cards can move between columns live.
  const [drag, setDrag] = useState(null); // { activeId, from: status, fromIndex, columns: { STATUS: [ids] } }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // small move needed, so clicks still work
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }), // long-press on touch, so scrolling works
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardsById = useMemo(() => {
    const map = {};
    for (const cards of Object.values(serverColumns ?? {})) for (const c of cards) map[c.id] = c;
    return map;
  }, [serverColumns]);

  const serverIds = useMemo(
    () => Object.fromEntries(Object.entries(serverColumns ?? {}).map(([s, cards]) => [s, cards.map((c) => c.id)])),
    [serverColumns],
  );
  const columns = drag?.columns ?? serverIds;
  const filtered = Boolean(q || types.length);

  const name = (id) => cardsById[id]?.company ?? "card";
  const label = (id) => STATUS[findColumn(id, columns)]?.label ?? "the board";

  async function commitMove(id, status, beforeId) {
    try {
      await moveApplication({ id, status, beforeId, boardArgs }).unwrap();
    } catch (err) {
      toast(`Couldn't move ${name(id)}: ${getApiError(err).message} Change undone.`, "error");
    }
  }

  function onDragStart({ active }) {
    const from = findColumn(active.id, serverIds);
    setDrag({ activeId: active.id, from, fromIndex: serverIds[from].indexOf(active.id), columns: serverIds });
  }

  // Moving over another column: move the card into it right away, so the drop slot opens up there.
  function onDragOver({ active, over }) {
    if (!over || !drag) return;
    const from = findColumn(active.id, drag.columns);
    const to = findColumn(over.id, drag.columns);
    if (!from || !to || from === to) return;
    setDrag((d) => {
      const next = { ...d.columns, [from]: d.columns[from].filter((id) => id !== active.id) };
      const overIndex = over.id === columnId(to) ? next[to].length : next[to].indexOf(over.id);
      next[to] = [...next[to]];
      next[to].splice(overIndex === -1 ? next[to].length : overIndex, 0, active.id);
      return { ...d, columns: next };
    });
  }

  function onDragEnd({ active, over }) {
    if (!over || !drag) return setDrag(null);
    const status = findColumn(active.id, drag.columns);
    let ids = drag.columns[status];
    // Reordering within the column the card is now in.
    if (findColumn(over.id, drag.columns) === status && over.id !== active.id && !String(over.id).startsWith(COLUMN_PREFIX)) {
      ids = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    }
    const index = ids.indexOf(active.id);
    setDrag(null);
    if (status === drag.from && index === drag.fromIndex) return; // dropped where it started
    commitMove(active.id, status, ids[index + 1] ?? null);
  }

  const toggle = (status) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  const announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)} in ${label(active.id)}. Use the arrow keys to move it, Space to drop, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} is over ${label(over.id)}.` : `${name(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} dropped in ${label(over.id)}.` : `${name(active.id)} was not moved.`),
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Board</h1>
        <Link href="/applications/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New application
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox key={q === "" ? "empty" : "q"} value={q} onSearch={(value) => update({ q: value })} label="Filter cards" placeholder="Filter cards…" />
        <MultiSelect label="Type" options={EMPLOYMENT_TYPES} value={types} onChange={(employmentType) => update({ employmentType })} />
        {filtered && (
          <button onClick={() => update({ q: "", employmentType: [] })} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            ✕ Clear
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Drag cards between columns, or focus a card and press Space, then the arrow keys. On a phone, use “Move to” on each card.
      </p>

      {isLoading || !me ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load your board." onRetry={refetch} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrag(null)}
          accessibility={{ announcements }}
        >
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {STATUSES.map(({ value: status }) => (
              <div key={status} className="snap-start">
                <Column
                  status={status}
                  cards={(columns[status] ?? []).map((id) => cardsById[id]).filter(Boolean)}
                  collapsed={collapsed.has(status)}
                  onToggle={() => toggle(status)}
                  today={today}
                  timeZone={me.timezone}
                  onMove={(card, to) => to !== card.status && commitMove(card.id, to, null)}
                />
              </div>
            ))}
          </div>
          <DragOverlay>
            {drag && cardsById[drag.activeId] ? <CardBody card={cardsById[drag.activeId]} today={today} timeZone={me.timezone} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
