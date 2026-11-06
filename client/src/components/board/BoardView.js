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
import { CompanyLogo, Tag } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MoreMenu } from "@/components/ui/MoreMenu";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchBox } from "@/components/ui/SearchBox";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/States";
import { EMPLOYMENT_TYPES, STATUS, STATUSES, labelOf } from "@/lib/constants";
import { formatDateTime, formatSalary } from "@/lib/format";
import { getApiError, useGetBoardQuery, useGetMeQuery, useMoveApplicationMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

const DAY = 24 * 60 * 60 * 1000;
const COLUMN_PREFIX = "column:";
const columnId = (status) => `${COLUMN_PREFIX}${status}`;
const COLLAPSED_BY_DEFAULT = ["WITHDRAWN"]; // KAN-5: Rejected and Withdrawn are collapsible

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

const where = (card) => [card.location, labelOf(EMPLOYMENT_TYPES, card.employmentType)].filter(Boolean).join(" · ");
const shortDate = (iso, timeZone) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(new Date(iso));
const CLOSED = ["REJECTED", "WITHDRAWN"];

/** Footer line of a card (Figma KanbanCard "footer"): what happens next, or how long it has been. */
function footerFor(card, today, timeZone) {
  if (card.nextInterviewAt) {
    return { icon: "calendar", tone: "text-amber-700", text: `Interview ${shortDate(card.nextInterviewAt, timeZone)}` };
  }
  if (card.status === "OFFER") return { icon: "sparkles", tone: "text-emerald-700", text: `Offer since ${shortDate(card.updatedAt, timeZone)}` };
  if (CLOSED.includes(card.status)) return { icon: "clock", tone: "text-ink-3", text: `Closed ${shortDate(card.updatedAt, timeZone)}` };
  if (card.appliedAt) return { icon: "clock", tone: "text-ink-3", text: appliedLabel(card.appliedAt, today) };
  const days = Math.floor((today - Date.parse(card.createdAt ?? card.updatedAt)) / DAY);
  return { icon: "clock", tone: "text-ink-3", text: days <= 0 ? "Saved today" : days === 1 ? "Saved 1 day ago" : `Saved ${days} days ago` };
}

function CardBody({ card, today, timeZone, dragHandleProps, onMove, overlay = false, tilt = false }) {
  const salary = formatSalary(card, { compact: true });
  const footer = footerFor(card, today, timeZone);
  const closed = CLOSED.includes(card.status);
  const stop = (e) => e.stopPropagation(); // keep clicks/keys inside controls from starting a drag

  return (
    <div
      {...dragHandleProps}
      className={`flex flex-col gap-2.5 rounded-[10px] bg-white p-3.5 text-sm shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        card.status === "OFFER" ? "border-[1.5px] border-emerald-700" : "border border-line"
      } ${closed && !overlay ? "opacity-65" : ""} ${overlay ? `cursor-grabbing shadow-pop ${tilt ? "rotate-2" : ""}` : "cursor-grab"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <CompanyLogo name={card.company} size="sm" />
        {!overlay && (
          <MoreMenu
            label={`More for ${card.company}`}
            className="-m-1"
            items={[
              { href: `/applications/${card.id}`, label: "Open" },
              { href: `/applications/${card.id}/edit`, label: "Edit details" },
            ]}
          />
        )}
      </div>
      <div className="min-w-0 space-y-px">
        <Link
          href={`/applications/${card.id}`}
          draggable={false}
          onKeyDown={stop}
          className="block leading-5 font-semibold break-words text-ink hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {card.company}
        </Link>
        <p className="text-xs leading-4 text-ink-2">{card.jobTitle}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag icon={<Icon name="mapPin" size={12} className="text-ink-3" />}>{where(card)}</Tag>
        {salary && <Tag icon={<Icon name="banknote" size={12} className="text-ink-3" />}>{salary}</Tag>}
      </div>
      <div className="h-px bg-line-subtle" />
      <p className={`flex items-start gap-1.5 text-xs leading-4 ${footer.tone}`}>
        <Icon name={footer.icon} size={13} className="mt-px" />
        {footer.text}
      </p>
      {/* Touch-friendly alternative to dragging */}
      {onMove && (
        <label className="flex items-center gap-1.5 text-xs text-ink-2 md:hidden" onPointerDown={stop} onKeyDown={stop}>
          Move to
          <select value={card.status} onChange={(e) => onMove(card, e.target.value)} className="field h-7 w-auto px-1.5 text-xs">
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
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="relative">
      {/* While dragging, the card stays mounted (it keeps keyboard focus) under the dashed "Drop zone". */}
      <div className={isDragging ? "opacity-0" : ""}>
        <CardBody
          card={card}
          today={today}
          timeZone={timeZone}
          onMove={onMove}
          dragHandleProps={{ ...attributes, ...listeners, "aria-roledescription": "draggable card", "aria-label": `${card.company}, ${card.jobTitle}` }}
        />
      </div>
      {isDragging && <div aria-hidden className="absolute inset-0 rounded-[10px] border-[1.5px] border-dashed border-brand-500 bg-brand-50" />}
    </li>
  );
}

// ───────────────────────── Column ─────────────────────────

function Column({ status, cards, collapsed, onToggle, today, timeZone, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const s = STATUS[status];
  const ring = isOver ? "ring-2 ring-brand-500/60" : "";
  const collapsible = CLOSED.includes(status); // KAN-5

  if (collapsed) {
    return (
      <section ref={setNodeRef} aria-label={`${s.label} column, ${cards.length} applications, collapsed`} className={`w-10 shrink-0 self-start rounded-xl bg-subtle ${ring}`}>
        <button
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`Expand ${s.label}`}
          className="flex h-full min-h-64 w-full flex-col items-center gap-3 rounded-xl py-3 text-sm font-semibold text-ink hover:bg-slate-200/60"
        >
          <span aria-hidden className="size-2 rounded-full" style={{ background: s.dot }} />
          <span className="[writing-mode:vertical-rl]">{s.label}</span>
          <span className="rounded-full bg-white px-[7px] py-px text-xs leading-4 font-medium text-ink-2">{cards.length}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label={`${s.label} column, ${cards.length} applications`}
      className={`flex min-w-[160px] flex-1 basis-0 flex-col gap-2.5 rounded-xl bg-subtle px-2 py-3 ${ring}`}
    >
      <header className="flex items-center gap-1.5 px-1 pb-1">
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.dot }} />
        <h2 className="shrink-0 text-sm leading-5 font-semibold whitespace-nowrap text-ink">
          {collapsible ? (
            // KAN-5: Rejected and Withdrawn collapse by clicking their title.
            <button onClick={onToggle} aria-expanded title={`Collapse ${s.label}`} className="rounded hover:underline">
              {s.label}
            </button>
          ) : (
            s.label
          )}
        </h2>
        <span className="shrink-0 rounded-full bg-white px-[7px] py-px text-xs leading-4 font-medium text-ink-2 tabular-nums">{cards.length}</span>
        <span className="min-w-0 flex-1" />
        <Link href={`/applications/new?status=${status}`} aria-label={`Add to ${s.label}`} className="grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:text-ink">
          <Icon name="plus" size={16} />
        </Link>
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2.5">
          {cards.map((card) => <SortableCard key={card.id} card={card} today={today} timeZone={timeZone} onMove={onMove} />)}
        </ul>
      </SortableContext>
      <Link
        href={`/applications/new?status=${status}`}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2.5 text-xs leading-4 font-medium text-ink-3 hover:border-brand-200 hover:bg-white hover:text-brand-600"
      >
        <Icon name="plus" size={14} />
        Add application
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
  const [showFilters, setShowFilters] = useState(filtered);

  const name = (id) => cardsById[id]?.company ?? "card";
  const label = (id) => STATUS[findColumn(id, columns)]?.label ?? "the board";

  async function commitMove(id, status, beforeId) {
    try {
      await moveApplication({ id, status, beforeId, boardArgs }).unwrap();
    } catch (err) {
      toast(`Couldn't move ${name(id)}: ${getApiError(err).message} Change undone.`, "error");
    }
  }

  function onDragStart({ active, activatorEvent }) {
    const from = findColumn(active.id, serverIds);
    setDrag({ activeId: active.id, from, fromIndex: serverIds[from].indexOf(active.id), columns: serverIds, keyboard: activatorEvent?.type === "keydown" });
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
    <div className="space-y-6">
      <PageHeader title="Board" subtitle="Drag cards between stages to update their status.">
        <Button variant="secondary" icon="filter" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          Filters
        </Button>
        <ButtonLink href="/applications/new" icon="plus">New application</ButtonLink>
      </PageHeader>

      {showFilters && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox
            key={q === "" ? "empty" : "q"}
            value={q}
            onSearch={(value) => update({ q: value })}
            label="Filter cards"
            placeholder="Filter by company or role"
            className="sm:w-72"
          />
          <MultiSelect label="Type" options={EMPLOYMENT_TYPES} value={types} onChange={(employmentType) => update({ employmentType })} />
          {filtered && (
            <button
              onClick={() => update({ q: "", employmentType: [] })}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-ink-2 hover:bg-subtle"
            >
              <Icon name="x" size={14} />
              Clear
            </button>
          )}
        </div>
      )}

      <p className="sr-only">
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
          <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
            {STATUSES.map(({ value: status }) => (
              <Column
                key={status}
                status={status}
                cards={(columns[status] ?? []).map((id) => cardsById[id]).filter(Boolean)}
                collapsed={collapsed.has(status)}
                onToggle={() => toggle(status)}
                today={today}
                timeZone={me.timezone}
                onMove={(card, to) => to !== card.status && commitMove(card.id, to, null)}
              />
            ))}
          </div>
          <DragOverlay>
            {drag && cardsById[drag.activeId] ? <CardBody card={cardsById[drag.activeId]} today={today} timeZone={me.timezone} overlay tilt={!drag.keyboard} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
