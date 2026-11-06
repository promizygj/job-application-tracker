"use client";

import Link from "next/link";
import { useState } from "react";
import { Pill, Tag } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { INTERVIEW_TYPES, OUTCOME, OUTCOMES, labelOf } from "@/lib/constants";
import { formatTime } from "@/lib/time";
import { getApiError, useDeleteInterviewMutation, useUpdateInterviewMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

export function OutcomeBadge({ outcome }) {
  const o = OUTCOME[outcome];
  return <Pill className={o.badge} dot={o.dot}>{o.label}</Pill>;
}

/**
 * One interview row. Times are shown in `viewerTz` (the user's profile time zone), with the
 * interview's own zone noted when different. `application` = { id, company, jobTitle }.
 */
export function InterviewItem({ interview, application, viewerTz, now, onEdit, showApplication = true }) {
  const toast = useToast();
  const [updateInterview, { isLoading: savingOutcome }] = useUpdateInterviewMutation();
  const [deleteInterview, { isLoading: deleting }] = useDeleteInterviewMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const start = new Date(interview.startsAt);
  const end = new Date(start.getTime() + interview.durationMinutes * 60_000);
  const isPast = start.getTime() < now;
  const otherZone = interview.timezone !== viewerTz;

  async function setOutcome(e) {
    try {
      await updateInterview({ id: interview.id, applicationId: application.id, outcome: e.target.value }).unwrap();
      toast("Outcome saved");
    } catch (err) {
      toast(getApiError(err).message, "error");
    }
  }

  async function remove() {
    try {
      await deleteInterview({ id: interview.id, applicationId: application.id }).unwrap();
      toast("Interview deleted");
    } catch (err) {
      toast(getApiError(err).message, "error");
      setConfirmDelete(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row">
      <div className="w-28 shrink-0 text-sm">
        <p className="font-semibold">
          {formatTime(start, viewerTz)}–{formatTime(end, viewerTz)}
        </p>
        {otherZone && (
          <p className="text-xs text-slate-500" title={interview.timezone}>
            {formatTime(start, interview.timezone)} {interview.timezone.split("/").pop().replace(/_/g, " ")}
          </p>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">
            {showApplication && (
              <>
                <Link href={`/applications/${application.id}`} className="hover:underline">
                  {application.company}
                </Link>
                <span className="text-slate-400"> · </span>
              </>
            )}
            {interview.title}
          </p>
          <Tag>{labelOf(INTERVIEW_TYPES, interview.type)}</Tag>
          {(isPast || interview.outcome !== "PENDING") && <OutcomeBadge outcome={interview.outcome} />}
        </div>
        {showApplication && <p className="text-ink-2">{application.jobTitle}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
          {interview.interviewerName && (
            <span>
              👤 {interview.interviewerName}
              {interview.interviewerRole && `, ${interview.interviewerRole}`}
            </span>
          )}
          {interview.meetingUrl && (
            <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
              🔗 Join meeting ↗
            </a>
          )}
          {interview.location && <span>📍 {interview.location}</span>}
        </div>
        {interview.prepNotes && (
          <details className="text-slate-700">
            <summary className="cursor-pointer text-slate-500 select-none">Preparation notes</summary>
            <p className="mt-1 whitespace-pre-wrap">{interview.prepNotes}</p>
          </details>
        )}
        {interview.feedbackNotes && (
          <details className="text-slate-700">
            <summary className="cursor-pointer text-slate-500 select-none">Feedback</summary>
            <p className="mt-1 whitespace-pre-wrap">{interview.feedbackNotes}</p>
          </details>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-start gap-2 sm:flex-col sm:items-end">
        {isPast && (
          <label className="flex items-center gap-1 text-xs text-ink-2">
            Outcome
            <select
              value={interview.outcome}
              onChange={setOutcome}
              disabled={savingOutcome}
              className="rounded border border-line bg-white px-1.5 py-1 text-xs"
            >
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <div className="flex gap-1">
          <button onClick={() => onEdit(interview)} className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-subtle">
            {isPast && !interview.feedbackNotes ? "Add feedback" : "Edit"}
          </button>
          <button onClick={() => setConfirmDelete(true)} className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this interview?"
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        {interview.title} with {application.company} will be removed.
      </ConfirmDialog>
    </li>
  );
}
