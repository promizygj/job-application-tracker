"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { EmploymentTypeTag, StatusBadge } from "@/components/ui/Badge";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchBox } from "@/components/ui/SearchBox";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { EMPLOYMENT_TYPES, SORT_OPTIONS, STATUSES } from "@/lib/constants";
import { formatDate, formatSalary } from "@/lib/format";
import { useListApplicationsQuery } from "@/store/apiSlice";

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

function Pagination({ meta, onPage, limit, onLimit }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-slate-600">
        Showing <strong>{from}–{to}</strong> of <strong>{meta.total}</strong>
      </p>
      <div className="flex items-center gap-2">
        <Select
          label="Per page"
          hideLabel
          value={String(limit)}
          onChange={(e) => onLimit(Number(e.target.value))}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} per page` }))}
        />
        <button
          onClick={() => onPage(meta.page - 1)}
          disabled={meta.page <= 1}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span className="px-1 text-slate-600">
          {meta.page} / {Math.max(meta.totalPages, 1)}
        </span>
        <button
          onClick={() => onPage(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}

export function ApplicationsView() {
  const [state, update] = useListParams();
  const { data, isLoading, isFetching, isError, refetch } = useListApplicationsQuery(toApiParams(state));
  const filtered = Boolean(state.q || state.status.length || state.employmentType.length || state.appliedFrom || state.appliedTo);
  const items = data?.items ?? [];

  // Out-of-range page (e.g. after deleting the last item on it) → jump to the last page.
  useEffect(() => {
    if (data && data.meta.totalPages > 0 && state.page > data.meta.totalPages) update({ page: data.meta.totalPages });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Applications {data && <span className="text-slate-400">({data.meta.total})</span>}
        </h1>
        <Link href="/applications/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New application
        </Link>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchBox key={state.q === "" ? "empty" : "q"} value={state.q} onSearch={(q) => update({ q })} label="Search company or job title" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <MultiSelect label="Status" options={STATUSES} value={state.status} onChange={(status) => update({ status })} />
          <MultiSelect label="Type" options={EMPLOYMENT_TYPES} value={state.employmentType} onChange={(employmentType) => update({ employmentType })} />
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 sm:col-span-1">
            <span className="w-9 shrink-0 sm:w-auto">From</span>
            <input
              type="date"
              value={state.appliedFrom}
              max={state.appliedTo || undefined}
              onChange={(e) => update({ appliedFrom: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 sm:col-span-1">
            <span className="w-9 shrink-0 sm:w-auto">To</span>
            <input
              type="date"
              value={state.appliedTo}
              min={state.appliedFrom || undefined}
              onChange={(e) => update({ appliedTo: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <Select label="Sort" hideLabel value={state.sort} onChange={(e) => update({ sort: e.target.value })} options={SORT_OPTIONS} />
          {filtered && (
            <button
              onClick={() => update({ q: "", status: [], employmentType: [], appliedFrom: "", appliedTo: "" })}
              className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load your applications." onRetry={refetch} />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState title="No matching applications">Try a different search or clear the filters.</EmptyState>
        ) : (
          <EmptyState
            title="No applications yet"
            action={
              <Link href="/applications/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Add your first application
              </Link>
            }
          >
            Track every job you apply for, or save ones you&apos;re considering.
          </EmptyState>
        )
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-60" : ""}`} aria-busy={isFetching}>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Company</th>
                  <th scope="col" className="px-4 py-3 font-medium">Job title</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Salary</th>
                  <th scope="col" className="px-4 py-3 font-medium">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((a) => (
                  <tr key={a.id} className="group relative hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {/* The link covers the whole row (after:absolute) so the row is clickable but stays one tab stop. */}
                      <Link href={`/applications/${a.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-has-focus-visible:underline">
                        {a.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{a.jobTitle}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3"><EmploymentTypeTag type={a.employmentType} /></td>
                    <td className="px-4 py-3 text-slate-700">{formatSalary(a) ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(a.appliedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((a) => (
              <li key={a.id}>
                <Link href={`/applications/${a.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.company}</p>
                      <p className="truncate text-sm text-slate-600">{a.jobTitle}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <EmploymentTypeTag type={a.employmentType} />
                    {formatSalary(a) && <span>{formatSalary(a)}</span>}
                    {a.appliedAt && <span>Applied {formatDate(a.appliedAt)}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pagination meta={data?.meta} limit={state.limit} onPage={(page) => update({ page })} onLimit={(limit) => update({ limit })} />
    </div>
  );
}
