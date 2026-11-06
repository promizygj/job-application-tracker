"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { InterviewCard } from "@/components/dashboard/DashboardParts";
import { ApplicationDocuments } from "@/components/documents/ApplicationDocuments";
import { InterviewDialog } from "@/components/interviews/InterviewDialog";
import { InterviewItem } from "@/components/interviews/InterviewItem";
import { CompanyLogo, StatusBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { ErrorState, Spinner } from "@/components/ui/States";
import { formatBytes } from "@/lib/documents";
import { EMPLOYMENT_TYPES, JOB_TYPES, PRIORITIES, STATUS, STATUSES, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatSalary } from "@/lib/format";
import { browserTimeZone } from "@/lib/time";
import { getApiError, useDeleteApplicationMutation, useGetApplicationQuery, useGetMeQuery, useUpdateApplicationMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

const TABS = ["Overview", "Interviews", "Documents", "Activity"];

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-caps font-semibold text-ink-3 uppercase">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-ink">{children}</dd>
    </div>
  );
}

function Overview({ app }) {
  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base leading-6 font-semibold text-ink">Job details</h2>
          <Link href={`/applications/${app.id}/edit`} className="text-xs font-medium text-brand-600 hover:underline">
            Edit
          </Link>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          <Field label="Employment type">{app.jobType ? labelOf(JOB_TYPES, app.jobType) : "—"}</Field>
          <Field label="Work mode">{labelOf(EMPLOYMENT_TYPES, app.employmentType)}</Field>
          <Field label="Salary range">{formatSalary(app) ?? "—"}</Field>
          <Field label="Source">{app.source ?? "—"}</Field>
          <Field label="Applied on">{formatDate(app.appliedAt)}</Field>
          <Field label="Priority">{labelOf(PRIORITIES, app.priority)}</Field>
        </dl>
        <div className="my-6 h-px bg-line-subtle" />
        <h3 className="text-sm leading-5 font-semibold text-ink">About the role</h3>
        {app.jobDescription ? (
          <p className="mt-3 text-sm leading-5 whitespace-pre-wrap text-ink-2">{app.jobDescription}</p>
        ) : (
          <p className="mt-3 text-sm text-ink-3">No description saved.</p>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-base leading-6 font-semibold text-ink">Notes</h2>
        {app.notes ? (
          <p className="mt-4 rounded-[10px] border border-line bg-canvas px-4 py-3 text-sm leading-5 whitespace-pre-wrap text-ink">{app.notes}</p>
        ) : (
          <p className="mt-4 text-sm text-ink-3">
            No notes yet.{" "}
            <Link href={`/applications/${app.id}/edit`} className="font-medium text-brand-600 hover:underline">Add a note</Link>
          </p>
        )}
        <p className="mt-4 text-xs text-ink-3">
          Added {formatDate(app.createdAt, { timeZone: undefined })} · Updated {formatDate(app.updatedAt, { timeZone: undefined })}
        </p>
      </section>
    </div>
  );
}

function Interviews({ app }) {
  const { data: me } = useGetMeQuery();
  const viewerTz = me?.timezone ?? browserTimeZone();
  const [now] = useState(() => Date.now());
  const [dialog, setDialog] = useState(null); // { interview? } when open
  const application = { id: app.id, company: app.company, jobTitle: app.jobTitle };
  // Soonest upcoming first, then past interviews most recent first.
  const upcoming = app.interviews.filter((i) => Date.parse(i.startsAt) >= now);
  const past = app.interviews.filter((i) => Date.parse(i.startsAt) < now).reverse();

  const list = (items) => (
    <ul className="divide-y divide-line-subtle card">
      {items.map((i) => (
        <InterviewItem
          key={i.id}
          interview={i}
          application={application}
          viewerTz={viewerTz}
          now={now}
          showApplication={false}
          onEdit={(interview) => setDialog({ interview })}
        />
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setDialog({})} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Schedule interview
        </button>
      </div>
      {app.interviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">No interviews scheduled yet.</p>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Upcoming</h2>
          {list(upcoming)}
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Past</h2>
          {list(past)}
        </section>
      )}
      <InterviewDialog open={Boolean(dialog)} onClose={() => setDialog(null)} interview={dialog?.interview} application={application} />
    </div>
  );
}

function Timeline({ app }) {
  return (
    <ol className="card space-y-5 p-6">
      {app.statusChanges.map((c, i) => (
        <li key={c.id} className="relative flex items-center gap-3 pl-6">
          <span aria-hidden className="absolute left-0 size-2.5 rounded-full ring-4 ring-white" style={{ background: STATUS[c.toStatus]?.dot }} />
          {i < app.statusChanges.length - 1 && <span aria-hidden className="absolute top-4 left-[4px] h-7 w-0.5 bg-line" />}
          <StatusBadge status={c.toStatus} />
          <span className="text-sm text-ink-2">
            {c.fromStatus ? "moved" : "added"} {formatDateTime(c.changedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ───────────── Header pieces ─────────────

const STEPS = ["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER"];
const shortDate = (iso) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));

/** Saved → Applied → Assessment → Interview → Offer, with the date each stage was first reached. */
function Stepper({ app }) {
  const reached = {};
  for (const c of app.statusChanges) reached[c.toStatus] ??= c.changedAt;
  const closed = !STEPS.includes(app.status); // Rejected / Withdrawn
  const lastReached = closed ? Math.max(-1, ...STEPS.map((s, i) => (reached[s] ? i : -1))) : STEPS.indexOf(app.status);
  const steps = closed ? [...STEPS.slice(0, lastReached + 1), app.status] : STEPS;
  const current = closed ? steps.length - 1 : lastReached;

  return (
    <ol aria-label="Progress" className="flex items-start gap-3 overflow-x-auto pt-1 pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        const bad = now && closed;
        return (
          <li key={s} aria-current={now ? "step" : undefined} className="flex min-w-[140px] flex-1 items-start gap-3 last:flex-none">
            {done ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                <Icon name="check" size={14} />
              </span>
            ) : now ? (
              <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${bad ? "border-red-500" : "border-brand-600"}`}>
                <span className={`size-2.5 rounded-full ${bad ? "bg-red-500" : "bg-brand-600"}`} />
              </span>
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-line text-xs font-medium text-ink-3">{i + 1}</span>
            )}
            <span className="min-w-0">
              <span className={`block text-sm leading-5 font-semibold ${done || now ? "text-ink" : "text-ink-3"}`}>{STATUS[s].label}</span>
              <span className="block text-xs leading-4 text-ink-3">{reached[s] && (done || now) ? shortDate(reached[s]) : "—"}</span>
            </span>
            {i < steps.length - 1 && <span aria-hidden className={`mt-3.5 h-0.5 min-w-6 flex-1 rounded ${done ? "bg-brand-600" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Aside({ app, timeZone, onTab }) {
  const [now] = useState(() => Date.now());
  const next = app.interviews.find((i) => Date.parse(i.startsAt) >= now && i.outcome === "PENDING");
  const days = next ? Math.round((Date.parse(next.startsAt) - now) / 864e5) : null;

  return (
    <aside className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base leading-6 font-semibold text-ink">Next interview</h2>
          {next && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
            </span>
          )}
        </div>
        {next ? (
          <div className="mt-4">
            <InterviewCard interview={{ ...next, application: app }} timeZone={timeZone} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-3">No interview scheduled.</p>
        )}
        <Button variant="secondary" icon="calendar" onClick={() => onTab("Interviews")} className="mt-4 w-full">
          {app.interviews.length ? "All interviews" : "Plan an interview"}
        </Button>
      </section>

      <section className="card p-5">
        <h2 className="text-base leading-6 font-semibold text-ink">Documents sent</h2>
        {app.documents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No documents attached.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {app.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-[10px] bg-canvas px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                  <Icon name="file" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs leading-4 font-medium text-ink">{d.name}</span>
                  <span className="block text-xs leading-4 text-ink-3">
                    v{d.version}
                    {d.sizeBytes ? ` · ${formatBytes(d.sizeBytes)}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" icon="file" onClick={() => onTab("Documents")} className="mt-4 w-full">
          Manage documents
        </Button>
      </section>

      <section className="card p-5">
        <h2 className="text-base leading-6 font-semibold text-ink">Activity</h2>
        <ol className="mt-4 space-y-4">
          {[...app.statusChanges].reverse().map((c) => (
            <li key={c.id} className="flex gap-3">
              <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: STATUS[c.toStatus]?.dot }} />
              <span>
                <span className="block text-sm leading-5 font-medium text-ink">
                  {c.fromStatus ? `Moved to ${STATUS[c.toStatus]?.label}` : `Added as ${STATUS[c.toStatus]?.label}`}
                </span>
                <span className="block text-xs leading-4 text-ink-3">{shortDate(c.changedAt)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

export function ApplicationDetail() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const { data: me } = useGetMeQuery();
  // The tab survives browser Back/Forward but resets to Overview on a fresh visit (e.g. after editing).
  const [tabState, setTabState] = useState({ visit: router.bfcacheId, tab: "Overview" });
  const tab = tabState.visit === router.bfcacheId ? tabState.tab : "Overview";
  const setTab = (t) => setTabState({ visit: router.bfcacheId, tab: t });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: app, isLoading, isError, error, refetch } = useGetApplicationQuery(id);
  const [updateApplication, { isLoading: updating }] = useUpdateApplicationMutation();
  const [deleteApplication, { isLoading: deleting }] = useDeleteApplicationMutation();

  if (isLoading) return <Spinner />;
  if (isError) {
    return error?.status === 404 ? (
      <ErrorState message="This application doesn't exist or was deleted." />
    ) : (
      <ErrorState message="Couldn't load this application." onRetry={refetch} />
    );
  }

  async function changeStatus(e) {
    const status = e.target.value;
    try {
      await updateApplication({ id, status }).unwrap();
      toast(`Moved to ${labelOf(STATUSES, status)}`);
    } catch (err) {
      toast(getApiError(err).message, "error");
    }
  }

  async function remove() {
    try {
      await deleteApplication(id).unwrap();
      toast(`Deleted ${app.company} application`);
      router.replace("/applications");
    } catch (err) {
      toast(getApiError(err).message, "error");
      setConfirmDelete(false);
    }
  }

  const salary = formatSalary(app);
  const counts = { Interviews: app.interviews.length, Documents: app.documents.length };
  const timeZone = me?.timezone ?? browserTimeZone();

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs leading-4">
        <Link href="/applications" className="text-ink-3 hover:text-ink">Applications</Link>
        <Icon name="chevronRight" size={14} className="text-ink-3" />
        <span className="truncate font-medium text-ink">{app.company} — {app.jobTitle}</span>
      </nav>

      <header className="card space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 basis-[420px] items-start gap-4">
            <CompanyLogo name={app.company} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-h1 font-semibold text-ink">
                  <span className="sr-only">{app.company} · </span>
                  {app.jobTitle}
                </h1>
                <StatusBadge status={app.status} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm leading-5 text-ink-2">
                <span className="font-semibold text-ink">{app.company}</span>
                <span className="flex items-center gap-1.5">
                  <Icon name="mapPin" size={16} className="text-ink-3" />
                  {[app.location, labelOf(EMPLOYMENT_TYPES, app.employmentType)].filter(Boolean).join(" · ")}
                </span>
                {salary && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="banknote" size={16} className="text-ink-3" />
                    {salary}
                  </span>
                )}
                {app.appliedAt && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="clock" size={16} className="text-ink-3" />
                    Applied {formatDate(app.appliedAt)}
                  </span>
                )}
                {app.source && <span>via {app.source}</span>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {app.jobUrl && (
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                <Icon name="external" size={16} />
                View job post
              </a>
            )}
            {/* A native <select> laid over a primary button: looks like "Update status", works like a select. */}
            <label className={`relative ${buttonClass("primary")} ${updating ? "opacity-60" : ""}`}>
              <Icon name="check" size={16} />
              Update status
              <select
                aria-label="Status"
                value={app.status}
                onChange={changeStatus}
                disabled={updating}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-700 hover:bg-red-50 hover:text-red-700">
              Delete
            </Button>
          </div>
        </div>
        <Stepper app={app} />
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Application sections" className="flex gap-6 overflow-x-auto border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls={`panel-${t}`}
                onClick={() => setTab(t)}
                className="-mb-px flex items-center gap-2 border-b-2 border-transparent pb-2.5 text-sm leading-5 font-medium whitespace-nowrap text-ink-2 hover:text-ink aria-selected:border-brand-600 aria-selected:text-brand-700"
              >
                {t}
                {counts[t] != null && (
                  <>
                    <span aria-hidden className="rounded-full bg-subtle px-1.5 text-xs leading-4 text-ink-2">{counts[t]}</span>
                    <span className="sr-only"> ({counts[t]})</span>
                  </>
                )}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "Overview" && <Overview app={app} />}
            {tab === "Interviews" && <Interviews app={app} />}
            {tab === "Documents" && <ApplicationDocuments app={app} />}
            {tab === "Activity" && <Timeline app={app} />}
          </div>
        </div>

        <Aside app={app} timeZone={timeZone} onTab={setTab} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this application?"
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        {app.company} · {app.jobTitle} will be deleted with its interviews and status history. Attached documents stay in your library.
      </ConfirmDialog>
    </div>
  );
}
