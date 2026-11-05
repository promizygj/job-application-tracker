"use client";

import Link from "next/link";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { BarList } from "@/components/dashboard/BarList";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { STATUSES } from "@/lib/constants";
import { formatDateTime, percent } from "@/lib/format";
import { VIZ } from "@/lib/vizTokens";
import { useGetDashboardActivityQuery, useGetDashboardSummaryQuery, useGetMeQuery } from "@/store/apiSlice";

/** Stat tile: label · value (proportional figures) · supporting count. */
function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Panel({ title, subtitle, href, className = "", children }) {
  return (
    <section className={`flex flex-col rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {href && <Link href={href} className="shrink-0 text-sm text-indigo-600 hover:underline">View all</Link>}
      </div>
      <div className="flex-1 p-3">{children}</div>
    </section>
  );
}

export function DashboardView() {
  const { data: user } = useGetMeQuery();
  const { data, isLoading, isError, isFetching, refetch } = useGetDashboardSummaryQuery();
  const { data: weeks, isFetching: weeksFetching } = useGetDashboardActivityQuery(12);
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{firstName ? `Welcome, ${firstName}` : "Dashboard"}</h1>
        <Link href="/applications/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New application
        </Link>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <ErrorState message="Couldn't load your dashboard." onRetry={refetch} />
      ) : data.total === 0 ? (
        <EmptyState
          title="No applications yet"
          action={
            <Link href="/applications/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Add your first application
            </Link>
          }
        >
          Add the jobs you&apos;ve applied for (or want to) and your stats will show up here.
        </EmptyState>
      ) : (
        // While refetching, keep the previous render at reduced opacity (no skeleton flash).
        <div className={`space-y-4 transition-opacity ${isFetching || weeksFetching ? "opacity-70" : ""}`}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total applications" value={data.total} hint={`${data.counts.applied} sent`} />
            <StatCard label="Response rate" value={percent(data.rates.response)} hint={`${data.counts.responded} heard back`} />
            <StatCard label="Interview rate" value={percent(data.rates.interview)} hint={`${data.counts.interviewed} reached interview`} />
            <StatCard label="Offer rate" value={percent(data.rates.offer)} hint={data.counts.offered === 1 ? "1 offer" : `${data.counts.offered} offers`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Activity" subtitle="Applications sent and interviews per week, last 12 weeks" className="lg:col-span-2">
              {weeks ? <ActivityChart weeks={weeks} /> : <Spinner />}
            </Panel>

            <Panel title="Pipeline" subtitle="Applications that reached each stage">
              <BarList
                label="Pipeline stages"
                items={[
                  { key: "applied", label: "Applied", value: data.counts.applied, color: VIZ.ordinal[0] },
                  {
                    key: "interview",
                    label: "Interview",
                    value: data.counts.interviewed,
                    color: VIZ.ordinal[1],
                    note: data.counts.applied ? `${percent(data.rates.interview)} of applied` : undefined,
                  },
                  {
                    key: "offer",
                    label: "Offer",
                    value: data.counts.offered,
                    color: VIZ.ordinal[2],
                    note: data.counts.applied ? `${percent(data.rates.offer)} of applied` : undefined,
                  },
                ]}
              />
              <p className="mt-3 px-2 text-xs text-slate-500">
                Counts every application that ever reached the stage, even if it later moved on (e.g. interview → rejected).
              </p>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="By status" subtitle="Where every application is now">
              <BarList
                label="Applications by status"
                items={STATUSES.map((s) => ({
                  key: s.value,
                  label: s.label,
                  value: data.byStatus[s.value],
                  color: VIZ.series[0], // one series → one hue; bar length carries the value
                  href: `/applications?status=${s.value}`,
                }))}
              />
            </Panel>

            <Panel title="Upcoming interviews" href="/interviews">
              {data.upcomingInterviews.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">No interviews scheduled.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.upcomingInterviews.map((i) => (
                    <li key={i.id}>
                      <Link href={`/applications/${i.application.id}`} className="block rounded px-2 py-2 hover:bg-slate-50">
                        <p className="text-sm font-medium">{formatDateTime(i.startsAt, user?.timezone)}</p>
                        <p className="text-sm text-slate-600">
                          {i.application.company} · {i.title}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recently added" href="/applications">
              <ul className="divide-y divide-slate-100">
                {data.recentApplications.map((a) => (
                  <li key={a.id}>
                    <Link href={`/applications/${a.id}`} className="flex items-center gap-3 rounded px-2 py-2 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.company}</p>
                        <p className="truncate text-sm text-slate-600">{a.jobTitle}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
