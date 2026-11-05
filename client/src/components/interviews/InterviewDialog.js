"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { DURATIONS, INTERVIEW_TYPES, OUTCOMES } from "@/lib/constants";
import { allTimeZones, browserTimeZone, isoToZoned, zonedToIso } from "@/lib/time";
import {
  getApiError,
  useCreateInterviewMutation,
  useGetMeQuery,
  useListApplicationsQuery,
  useUpdateApplicationMutation,
  useUpdateInterviewMutation,
} from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

function initialValues(interview, defaultTz) {
  if (!interview) {
    return {
      applicationId: "",
      title: "",
      type: "VIDEO",
      date: "",
      time: "",
      durationMinutes: "60",
      timezone: defaultTz,
      location: "",
      meetingUrl: "",
      interviewerName: "",
      interviewerRole: "",
      interviewerEmail: "",
      prepNotes: "",
      outcome: "PENDING",
      feedbackNotes: "",
    };
  }
  const { date, time } = isoToZoned(interview.startsAt, interview.timezone);
  const str = (v) => v ?? "";
  return {
    applicationId: interview.applicationId,
    title: interview.title,
    type: interview.type,
    date,
    time,
    durationMinutes: String(interview.durationMinutes),
    timezone: interview.timezone,
    location: str(interview.location),
    meetingUrl: str(interview.meetingUrl),
    interviewerName: str(interview.interviewerName),
    interviewerRole: str(interview.interviewerRole),
    interviewerEmail: str(interview.interviewerEmail),
    prepNotes: str(interview.prepNotes),
    outcome: interview.outcome,
    feedbackNotes: str(interview.feedbackNotes),
  };
}

function validate(v, needsApplication) {
  const e = {};
  if (needsApplication && !v.applicationId) e.applicationId = "Choose the application this interview is for";
  if (!v.title.trim()) e.title = "Give the interview a title, e.g. “Technical round 1”";
  if (!v.date) e.date = "Pick a date";
  if (!v.time) e.time = "Pick a start time";
  if (v.meetingUrl && !/^https?:\/\//i.test(v.meetingUrl.trim())) e.meetingUrl = "Start with http:// or https://";
  if (v.interviewerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.interviewerEmail.trim())) e.interviewerEmail = "Enter a valid email";
  return e;
}

/** Search-as-you-type picker over the user's applications. */
function ApplicationPicker({ value, onChange, error }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useListApplicationsQuery({ ...(q && { q }), sort: "-updatedAt", limit: 50 });
  const items = data?.items ?? [];
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">Application *</legend>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search company or job title…"
        aria-label="Search applications"
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      <Select
        label="Application"
        hideLabel
        value={value}
        onChange={onChange}
        error={error}
        placeholder={isFetching ? "Loading…" : items.length ? "Choose an application" : "No matching applications"}
        options={items.map((a) => ({ value: a.id, label: `${a.company} · ${a.jobTitle}` }))}
      />
    </fieldset>
  );
}

/**
 * Schedule (no `interview`) or edit (`interview` given). Pass `application` ({ id, company }) to fix
 * the application; otherwise a picker is shown. After scheduling, offers to move the application to
 * Interview when the API suggests it (INT-4).
 */
export function InterviewDialog({ open, onClose, interview, application }) {
  const { data: me } = useGetMeQuery();
  const toast = useToast();
  const editing = Boolean(interview);
  const [createInterview] = useCreateInterviewMutation();
  const [updateInterview] = useUpdateInterviewMutation();
  const [updateApplication, { isLoading: moving }] = useUpdateApplicationMutation();
  const [suggestion, setSuggestion] = useState(null); // { applicationId, company }

  async function moveToInterview() {
    try {
      await updateApplication({ id: suggestion.applicationId, status: "INTERVIEW" }).unwrap();
      toast(`Moved ${suggestion.company} to Interview`);
    } catch (err) {
      toast(getApiError(err).message, "error");
    }
    setSuggestion(null);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? "Edit interview" : "Schedule interview"} size="max-w-2xl">
        <InterviewForm
          key={interview?.id ?? "new"}
          interview={interview}
          application={application}
          defaultTz={me?.timezone ?? browserTimeZone()}
          onCancel={onClose}
          onSubmit={async (body) => {
            if (editing) {
              await updateInterview({ id: interview.id, applicationId: interview.applicationId, ...body }).unwrap();
              toast("Interview updated");
              onClose();
              return;
            }
            const { applicationId, ...rest } = body;
            const result = await createInterview({ applicationId, ...rest }).unwrap();
            toast(`Interview scheduled with ${result.interview.application.company}`);
            onClose();
            if (result.suggestedStatus === "INTERVIEW") {
              setSuggestion({ applicationId, company: result.interview.application.company });
            }
          }}
        />
      </Modal>
      <ConfirmDialog
        open={Boolean(suggestion)}
        title={`Move ${suggestion?.company ?? ""} to Interview?`}
        confirmLabel="Move to Interview"
        cancelLabel="Not now"
        loading={moving}
        onConfirm={moveToInterview}
        onCancel={() => setSuggestion(null)}
      >
        You&apos;ve scheduled an interview, so this application is probably at the interview stage now.
      </ConfirmDialog>
    </>
  );
}

function InterviewForm({ interview, application, defaultTz, onCancel, onSubmit }) {
  const editing = Boolean(interview);
  const [values, setValues] = useState(() => ({
    ...initialValues(interview, defaultTz),
    ...(application && { applicationId: application.id }),
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [zones] = useState(() => {
    const list = allTimeZones();
    return list.includes(values.timezone) ? list : [values.timezone, ...list];
  });

  const field = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
    },
  });

  async function submit(e) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(values, !editing && !application);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    const { date, time, durationMinutes, applicationId, outcome, feedbackNotes, ...rest } = values;
    const body = {
      ...rest,
      startsAt: zonedToIso(date, time, values.timezone),
      durationMinutes: Number(durationMinutes),
      ...(editing ? { outcome, feedbackNotes } : { applicationId }),
    };
    setSaving(true);
    try {
      await onSubmit(body);
    } catch (err) {
      const { message, fieldErrors } = getApiError(err);
      setErrors(fieldErrors.startsAt ? { ...fieldErrors, date: fieldErrors.startsAt } : fieldErrors);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  const tzOptions = zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
  const localPreview =
    values.date && values.time && values.timezone !== defaultTz
      ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: defaultTz }).format(
          new Date(zonedToIso(values.date, values.time, values.timezone)),
        )
      : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert type="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {editing || application ? (
          <p className="text-sm text-slate-600 sm:col-span-2">
            For <strong>{application?.company ?? interview.application?.company}</strong>
            {(application?.jobTitle ?? interview?.application?.jobTitle) && ` · ${application?.jobTitle ?? interview.application.jobTitle}`}
          </p>
        ) : (
          <ApplicationPicker {...field("applicationId")} />
        )}
        <Input label="Title *" placeholder="e.g. Technical round 1" {...field("title")} />
        <Select label="Type *" options={INTERVIEW_TYPES} {...field("type")} />
        <Input label="Date *" type="date" {...field("date")} />
        <Input label="Start time *" type="time" {...field("time")} />
        <Select label="Duration" options={DURATIONS.some((d) => d.value === values.durationMinutes) ? DURATIONS : [...DURATIONS, { value: values.durationMinutes, label: `${values.durationMinutes} min` }]} {...field("durationMinutes")} />
        <div>
          <Select label="Time zone" options={tzOptions} {...field("timezone")} />
          {localPreview && <p className="mt-1 text-xs text-slate-500">That&apos;s {localPreview} your time.</p>}
        </div>
        <Input label="Meeting link" type="url" placeholder="https://meet…" {...field("meetingUrl")} />
        <Input label="Location" placeholder="Office address, or “Phone”" {...field("location")} />
        <Input label="Interviewer name" {...field("interviewerName")} />
        <Input label="Interviewer role" placeholder="e.g. Engineering Manager" {...field("interviewerRole")} />
        <Input label="Interviewer email" type="email" className="sm:col-span-2" {...field("interviewerEmail")} />
      </div>
      <Textarea label="Preparation notes" rows={4} placeholder="Topics to revise, questions to ask…" {...field("prepNotes")} />
      {editing && (
        <div className="grid gap-4 rounded-md bg-slate-50 p-3 sm:grid-cols-3">
          <Select label="Outcome" options={OUTCOMES} {...field("outcome")} />
          <Textarea label="Feedback / how it went" rows={3} className="sm:col-span-2" {...field("feedbackNotes")} />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{editing ? "Save changes" : "Schedule"}</Button>
      </div>
    </form>
  );
}
