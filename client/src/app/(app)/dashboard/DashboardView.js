"use client";

import { useState } from "react";
import Link from "next/link";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { BarList } from "@/components/dashboard/BarList";
import { ApplicationsTable, Card, CardHeader, InterviewCard, StatCard, ViewAll } from "@/components/dashboard/DashboardParts";
import { CompanyLogo } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ErrorState, PageHeader, Spinner } from "@/components/ui/States";
import { STATUSES } from "@/lib/constants";
import { percent } from "@/lib/format";
import { browserTimeZone } from "@/lib/time";
import { VIZ } from "@/lib/vizTokens";
import {
  getApiError,
  useGetDashboardActivityQuery,
  useGetDashboardSummaryQuery,
  useGetMeQuery,
  useListDocumentsQuery,
  useResendVerificationMutation,
} from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Original dashboard panel: title + subtitle header, optional "View all" link. */
function Panel({ title, subtitle, href, className = "", children }) {
  return (
    <section className={`card flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {href && <Link href={href} className="shrink-0 text-sm text-brand-600 hover:underline">View all</Link>}
      </div>
      <div className="flex-1 p-3">{children}</div>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { data: user } = useGetMeQuery();
  const { data, isLoading, isError, isFetching, refetch } = useGetDashboardSummaryQuery();
  const { data: weeks, isFetching: weeksFetching } = useGetDashboardActivityQuery(12);
  const [hello] = useState(greeting);
  const firstName = user?.name?.split(" ")[0];
  const timeZone = user?.timezone ?? browserTimeZone();

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Couldn't load your dashboard." onRetry={refetch} />;
  if (data.total === 0) return <GettingStarted user={user} firstName={firstName} />;

  const active = data.byStatus.APPLIED + data.byStatus.ASSESSMENT + data.byStatus.INTERVIEW;
  const upcoming = data.upcomingInterviews;

  return (
    // While refetching, keep the previous render at reduced opacity (no skeleton flash).
    <div className={`space-y-6 transition-opacity ${isFetching || weeksFetching ? "opacity-70" : ""}`}>
      <PageHeader
        title={firstName ? `${hello}, ${firstName}` : "Dashboard"}
        subtitle={`You have ${plural(upcoming.length, "upcoming interview")} and ${plural(active, "application")} in progress.`}
      >
        <ButtonLink href="/applications/new" icon="plus">New application</ButtonLink>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total applications" value={data.total} icon="briefcase" hint={`${data.counts.applied} sent`} />
        <StatCard
          label="Interviews"
          value={data.counts.interviewed}
          icon="calendar"
          tone="amber"
          hintIcon="calendar"
          hint={`${upcoming.length} upcoming`}
        />
        <StatCard
          label="Offers"
          value={data.counts.offered}
          icon="sparkles"
          tone="green"
          hint={data.counts.offered === 1 ? "1 offer" : `${data.counts.offered} offers`}
        />
        <StatCard
          label="Response rate"
          value={percent(data.rates.response)}
          icon="trendingUp"
          tone="blue"
          hint={`${data.counts.responded} heard back`}
        />
      </div>

      {/* Activity, Pipeline and By status: the original dashboard panels. */}
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

        <Card className="flex flex-col p-5 lg:col-span-2">
          <CardHeader title="Upcoming interviews" action={<ViewAll href="/interviews" />} />
          <div className="mt-4 grid flex-1 gap-2.5 md:grid-cols-2">
            {upcoming.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3 md:col-span-2">No interviews scheduled.</p>
            ) : (
              upcoming.slice(0, 4).map((i) => <InterviewCard key={i.id} interview={i} timeZone={timeZone} />)
            )}
          </div>
          <p className="mt-4 flex gap-2 rounded-[10px] bg-brand-50 px-3.5 py-3 text-xs leading-4 text-brand-700">
            <Icon name="sparkles" size={16} />
            Add prep notes to each interview so you walk in prepared.
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-end justify-between gap-3 px-5 py-5">
          <CardHeader title="Recent applications" subtitle="Your latest activity across all stages" />
          <ViewAll href="/applications">View all applications</ViewAll>
        </div>
        <ApplicationsTable items={data.recentApplications} caption="Recent applications" />
      </Card>
    </div>
  );
}

// ───────────── New user: getting started ─────────────

function Step({ done, current, title, text, action }) {
  return (
    <li
      className={`flex flex-wrap items-center gap-3.5 rounded-xl border px-3.5 py-3.5 ${
        current ? "border-brand-100 bg-brand-50" : "border-line bg-white"
      }`}
    >
      {done ? (
        <span className="grid size-7 place-items-center rounded-full bg-emerald-700 text-white">
          <Icon name="check" size={14} />
          <span className="sr-only">Done:</span>
        </span>
      ) : current ? (
        <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-white">
          <Icon name="plus" size={14} />
        </span>
      ) : (
        <span aria-hidden className="size-7 rounded-full border-2 border-line" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-5 font-semibold ${done ? "text-ink-3 line-through" : "text-ink"}`}>{title}</p>
        <p className="text-xs leading-4 text-ink-2">{text}</p>
      </div>
      {action}
    </li>
  );
}

function GettingStarted({ user, firstName }) {
  const toast = useToast();
  const [resend, { isLoading: resending }] = useResendVerificationMutation();
  const { data: cvs } = useListDocumentsQuery({ type: "CV" });
  const verified = Boolean(user?.emailVerified);
  const hasCv = Boolean(cvs?.length);
  const done = 1 + (verified ? 1 : 0) + (hasCv ? 1 : 0);

  async function resendVerification() {
    try {
      await resend().unwrap();
      toast("Verification email sent");
    } catch (err) {
      toast(getApiError(err).message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome to JobTrack, ${firstName}` : "Welcome to JobTrack"}
        subtitle="Let's get your job search organised — it only takes a couple of minutes."
      >
        <ButtonLink href="/applications/new" icon="plus">New application</ButtonLink>
      </PageHeader>

      <section className="card grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs leading-4 font-medium text-brand-700">
            <Icon name="sparkles" size={14} />
            Getting started · {done} of 4 done
          </span>
          <h2 className="mt-3 text-h2 font-semibold text-ink">Set up your job search</h2>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} aria-label="Setup progress">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${(done / 4) * 100}%` }} />
          </div>
          <ol className="mt-5 space-y-3">
            <Step done title="Create your account" text="You're in. Nice work." />
            <Step
              current
              title="Add your first application"
              text="Track a job you've applied to — or one you want to apply for."
              action={<ButtonLink href="/applications/new">Add application</ButtonLink>}
            />
            <Step
              done={verified}
              title="Verify your email"
              text="Unlocks document uploads."
              action={!verified && <Button variant="secondary" icon="mail" loading={resending} onClick={resendVerification}>Resend email</Button>}
            />
            <Step
              done={hasCv}
              title="Upload your résumé"
              text="Keep every version you send in one place."
              action={!hasCv && <ButtonLink href="/documents" variant="secondary" icon="upload">Upload</ButtonLink>}
            />
          </ol>
        </div>
        <BoardPreview />
      </section>
    </div>
  );
}

/** Decorative mini-board on the right of the getting-started card. */
function BoardPreview() {
  const columns = [
    { label: "Applied", dot: "#3b82f6", cards: ["Paystack", "Flutterwave"] },
    { label: "Interview", dot: "#f59e0b", cards: ["Moniepoint"] },
    { label: "Offer", dot: "#10b981", cards: ["Andela"] },
  ];
  return (
    <div aria-hidden className="hidden flex-col items-center justify-center gap-10 bg-gradient-to-b from-brand-50 to-brand-100 px-3 py-10 lg:flex">
      <div className="flex w-full items-start gap-2">
        {columns.map((c) => (
          <div key={c.label} className="flex-1 rounded-lg bg-white/60 p-2">
            <p className="flex items-center gap-1.5 px-1 pb-2 text-xs text-ink-2">
              <span className="size-1.5 rounded-full" style={{ background: c.dot }} />
              {c.label}
            </p>
            <div className="space-y-2">
              {c.cards.map((name) => (
                <div key={name} className="rounded-md bg-white p-2 shadow-card">
                  <div className="flex items-center gap-2">
                    <CompanyLogo name={name} size="sm" className="!size-6 !rounded-md !text-[10px]" />
                    <span className="truncate text-xs font-medium text-ink">{name}</span>
                  </div>
                  <div className="mt-1.5 ml-8 h-1 w-10 rounded bg-subtle" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs font-medium text-brand-700">Every application, every stage — in one place.</p>
    </div>
  );
}
