"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApplicationsTable } from "@/components/dashboard/DashboardParts";
import { CompanyLogo, EmploymentTypeTag, StatusBadge, Tag } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchBox } from "@/components/ui/SearchBox";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, PageHeader, Spinner } from "@/components/ui/States";
import { EMPLOYMENT_TYPES, SORT_OPTIONS, STATUSES } from "@/lib/constants";
import { formatDate, formatSalary } from "@/lib/format";
import { useGetDashboardSummaryQuery, useListApplicationsQuery } from "@/store/apiSlice";

const PAGE_SIZES = [10, 20, 50];
const csv = (v) => (v ? v.split(",").filter(Boolean) : []);

/** Filters live in the URL so views can be bookmarked and the back button works (SRCH-4). */
function useListParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = {
    q: params.get("q") ?? "",
    status: csv(params.get("status")),
    employmentType: csv(params.get("employmentType")),
    appliedFrom: params.get("appliedFrom") ?? "",
    appliedTo: params.get("appliedTo") ?? "",
    sort: params.get("sort") ?? "-createdAt",
    page: Number(params.get("page")) || 1,
    limit: Number(params.get("limit")) || 20,
  };

  /** Merge updates into the URL. Any change other than `page` goes back to page 1. */
  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      const str = Array.isArray(value) ? value.join(",") : String(value ?? "");
      if (str === "" || (key === "sort" && str === "-createdAt") || (key === "limit" && str === "20")) next.delete(key);
      else next.set(key, str);
    }
    if (!("page" in changes)) next.delete("page");
    else if (changes.page === 1) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return [state, update];
}

function toApiParams(s) {
  return {
    ...(s.q && { q: s.q }),
    ...(s.status.length && { status: s.status.join(",") }),
    ...(s.employmentType.length && { employmentType: s.employmentType.join(",") }),
    ...(s.appliedFrom && { appliedFrom: s.appliedFrom }),
    ...(s.appliedTo && { appliedTo: s.appliedTo }),
    sort: s.sort,
    page: s.page,
    limit: s.limit,
  };
}

/** Page numbers to show: first, last, current ±1, with gaps as "…". */
function pageList(page, total) {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["…", p] : [p]));
}

const pageBtn =
  "grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-white px-2.5 text-xs font-medium text-ink hover:bg-subtle disabled:text-ink-3 disabled:hover:bg-white";

function Pagination({ meta, onPage, limit, onLimit }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const totalPages = Math.max(meta.totalPages, 1);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
      <div className="flex items-center gap-3">
        <p className="text-xs text-ink-2">
          Showing {from}–{to} of {meta.total} applications
        </p>
        <Select
          label="Per page"
          hideLabel
          size="sm"
          value={String(limit)}
          onChange={(e) => onLimit(Number(e.target.value))}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} per page` }))}
        />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1} className={pageBtn}>
          Previous
        </button>
        {pageList(meta.page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap${i}`} className="px-1 text-xs text-ink-3">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === meta.page ? "page" : undefined}
              aria-label={`Page ${p}`}
              className={`${pageBtn} aria-[current=page]:border-brand-600 aria-[current=page]:bg-brand-600 aria-[current=page]:text-white`}
            >
              {p}
            </button>
          ),
        )}
        <button onClick={() => onPage(meta.page + 1)} disabled={meta.page >= meta.totalPages} className={pageBtn}>
          Next
        </button>
      </div>
    </nav>
  );
}

/** Status chips with counts (Figma: "All 24 · Wishlist 6 · Applied 9 …"). One click filters to that status. */
function StatusChips({ counts, total, selected, onSelect }) {
  const chip =
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs leading-4 font-medium transition-colors aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white";
  const count = "rounded-full px-1.5 text-[11px] tabular-nums";
  const only = selected.length === 1 ? selected[0] : null;
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
      <button aria-pressed={selected.length === 0} onClick={() => onSelect([])} className={`${chip} border-line bg-white text-ink hover:bg-subtle`}>
        All
        {total != null && <span className={`${count} ${selected.length === 0 ? "bg-white/20" : "bg-subtle text-ink-2"}`}>{total}</span>}
      </button>
      {STATUSES.map((s) => {
        const on = only === s.value;
        return (
          <button
            key={s.value}
            aria-pressed={on}
            onClick={() => onSelect(on ? [] : [s.value])}
            className={`${chip} border-line bg-white text-ink hover:bg-subtle`}
          >
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: s.dot }} />
            {s.label}
            {counts && <span className={`${count} ${on ? "bg-white/20" : "bg-subtle text-ink-2"}`}>{counts[s.value]}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ApplicationsView() {
  const [state, update] = useListParams();
  const { data, isLoading, isFetching, isError, refetch } = useListApplicationsQuery(toApiParams(state));
  const { data: summary } = useGetDashboardSummaryQuery();
  const advanced = Boolean(state.employmentType.length || state.appliedFrom || state.appliedTo || state.sort !== "-createdAt" || state.status.length > 1);
  const [showFilters, setShowFilters] = useState(advanced);
  const filtered = Boolean(state.q || state.status.length || state.employmentType.length || state.appliedFrom || state.appliedTo);
  const items = data?.items ?? [];
  const active = summary ? summary.byStatus.APPLIED + summary.byStatus.ASSESSMENT + summary.byStatus.INTERVIEW : null;

  // Out-of-range page (e.g. after deleting the last item on it) → jump to the last page.
  useEffect(() => {
    if (data && data.meta.totalPages > 0 && state.page > data.meta.totalPages) update({ page: data.meta.totalPages });
  });

  const subtitle = data
    ? `${data.meta.total} application${data.meta.total === 1 ? "" : "s"}${!filtered && active != null ? ` · ${active} still active` : ""}`
    : " ";

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" subtitle={subtitle}>
        <ButtonLink href="/applications/new" icon="plus">New application</ButtonLink>
      </PageHeader>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusChips counts={summary?.byStatus} total={summary?.total} selected={state.status} onSelect={(status) => update({ status })} />
          <div className="ml-auto flex items-center gap-3 max-sm:w-full">
            <SearchBox
              key={state.q === "" ? "empty" : "q"}
              value={state.q}
              onSearch={(q) => update({ q })}
              label="Search company or job title"
              placeholder="Filter by company or role"
              className="w-[220px] max-sm:flex-1"
            />
            <Button variant="secondary" icon="filter" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="h-10">
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <MultiSelect label="Status" options={STATUSES} value={state.status} onChange={(status) => update({ status })} />
              <MultiSelect label="Type" options={EMPLOYMENT_TYPES} value={state.employmentType} onChange={(employmentType) => update({ employmentType })} />
              <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-ink-2 sm:col-span-1">
                <span className="w-9 shrink-0 sm:w-auto">From</span>
                <input
                  type="date"
                  value={state.appliedFrom}
                  max={state.appliedTo || undefined}
                  onChange={(e) => update({ appliedFrom: e.target.value })}
                  className="field h-10"
                />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-ink-2 sm:col-span-1">
                <span className="w-9 shrink-0 sm:w-auto">To</span>
                <input
                  type="date"
                  value={state.appliedTo}
                  min={state.appliedFrom || undefined}
                  onChange={(e) => update({ appliedTo: e.target.value })}
                  className="field h-10"
                />
              </label>
              <Select label="Sort" hideLabel value={state.sort} onChange={(e) => update({ sort: e.target.value })} options={SORT_OPTIONS} />
            </div>
          </div>
        )}

        {filtered && (
          <button
            onClick={() => update({ q: "", status: [], employmentType: [], appliedFrom: "", appliedTo: "" })}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-2 hover:bg-subtle"
          >
            <Icon name="x" size={14} />
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load your applications." onRetry={refetch} />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState title="No matching applications">Try a different search or clear the filters.</EmptyState>
        ) : (
          <EmptyState title="No applications yet" action={<ButtonLink href="/applications/new" icon="plus">Add your first application</ButtonLink>}>
            Track every job you apply for, or save ones you&apos;re considering.
          </EmptyState>
        )
      ) : (
        <div className={`card overflow-hidden transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
          {/* Desktop table */}
          <div className="hidden md:block [&_thead]:border-t-0">
            <ApplicationsTable items={items} caption="Applications" />
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-line-subtle md:hidden">
            {items.map((a) => (
              <li key={a.id}>
                <Link href={`/applications/${a.id}`} className="flex items-start gap-3 p-4 hover:bg-brand-50/50">
                  <CompanyLogo name={a.company} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{a.company}</p>
                        <p className="truncate text-xs text-ink-2">{a.jobTitle}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <EmploymentTypeTag type={a.employmentType} />
                      {formatSalary(a) && <Tag>{formatSalary(a)}</Tag>}
                      {a.appliedAt && <span className="text-xs text-ink-3">Applied {formatDate(a.appliedAt)}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination meta={data?.meta} limit={state.limit} onPage={(page) => update({ page })} onLimit={(limit) => update({ limit })} />
        </div>
      )}
    </div>
  );
}
