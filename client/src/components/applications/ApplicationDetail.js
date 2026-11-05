"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApplicationDocuments } from "@/components/documents/ApplicationDocuments";
import { InterviewDialog } from "@/components/interviews/InterviewDialog";
import { InterviewItem } from "@/components/interviews/InterviewItem";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { ErrorState, Spinner } from "@/components/ui/States";
import { EMPLOYMENT_TYPES, JOB_TYPES, PRIORITIES, STATUSES, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime, formatSalary } from "@/lib/format";
import { browserTimeZone } from "@/lib/time";
import { getApiError, useDeleteApplicationMutation, useGetApplicationQuery, useGetMeQuery, useUpdateApplicationMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

const TABS = ["Overview", "Interviews", "Documents", "Timeline"];

function Overview({ app }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
        <h2 className="mb-2 font-medium">Job description</h2>
        {app.jobDescription ? (
          <p className="text-sm whitespace-pre-wrap text-slate-700">{app.jobDescription}</p>
        ) : (
          <p className="text-sm text-slate-500">No description saved.</p>
        )}
      </section>
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-slate-500">Job type</dt>
            <dd>{app.jobType ? labelOf(JOB_TYPES, app.jobType) : "—"}</dd>
            <dt className="text-slate-500">Priority</dt>
            <dd>{labelOf(PRIORITIES, app.priority)}</dd>
            <dt className="text-slate-500">Source</dt>
            <dd>{app.source ?? "—"}</dd>
            <dt className="text-slate-500">Added</dt>
            <dd>{formatDate(app.createdAt, { timeZone: undefined })}</dd>
            <dt className="text-slate-500">Updated</dt>
            <dd>{formatDate(app.updatedAt, { timeZone: undefined })}</dd>
          </dl>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Notes</h2>
          {app.notes ? <p className="text-sm whitespace-pre-wrap text-slate-700">{app.notes}</p> : <p className="text-sm text-slate-500">No notes yet.</p>}
        </section>
      </div>
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
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
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
        <button onClick={() => setDialog({})} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + Schedule interview
        </button>
      </div>
      {app.interviews.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No interviews scheduled yet.</p>
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
    <ol className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      {app.statusChanges.map((c, i) => (
        <li key={c.id} className="relative flex items-center gap-3 pl-6">
          <span aria-hidden className="absolute left-0 size-3 rounded-full bg-indigo-600 ring-4 ring-indigo-100" />
          {i < app.statusChanges.length - 1 && <span aria-hidden className="absolute top-4 left-[5px] h-6 w-0.5 bg-slate-200" />}
          <StatusBadge status={c.toStatus} />
          <span className="text-sm text-slate-600">
            {c.fromStatus ? "moved" : "added"} {formatDateTime(c.changedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ApplicationDetail() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
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

  return (
    <div className="space-y-6">
      <Link href="/applications" className="text-sm text-slate-600 hover:underline">← Applications</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {app.company} <span className="text-slate-400">·</span> {app.jobTitle}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span>{labelOf(EMPLOYMENT_TYPES, app.employmentType)}</span>
            {app.location && <span>· {app.location}</span>}
            {salary && <span>· {salary}</span>}
            {app.appliedAt && <span>· Applied {formatDate(app.appliedAt)}</span>}
            {app.source && <span>· via {app.source}</span>}
            {app.jobUrl && (
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                · Job post ↗
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select label="Status" hideLabel value={app.status} onChange={changeStatus} disabled={updating} options={STATUSES} />
          <Link href={`/applications/${id}/edit`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100">
            Edit
          </Link>
          <button onClick={() => setConfirmDelete(true)} className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Application sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-600 hover:text-slate-900 aria-selected:border-indigo-600 aria-selected:text-indigo-700"
          >
            {t} {counts[t] != null && <span className="text-slate-400">({counts[t]})</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "Overview" && <Overview app={app} />}
        {tab === "Interviews" && <Interviews app={app} />}
        {tab === "Documents" && <ApplicationDocuments app={app} />}
        {tab === "Timeline" && <Timeline app={app} />}
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
