"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CURRENCIES, EMPLOYMENT_TYPES, JOB_TYPES, PRIORITIES, SALARY_PERIODS, SOURCES, STATUSES } from "@/lib/constants";

const EMPTY = {
  company: "",
  jobTitle: "",
  jobUrl: "",
  location: "",
  source: "",
  employmentType: "",
  jobType: "",
  salaryCurrency: "",
  salaryMin: "",
  salaryMax: "",
  salaryPeriod: "YEARLY",
  status: "SAVED",
  appliedAt: "",
  priority: "MEDIUM",
  jobDescription: "",
  notes: "",
};

/** API application → form strings. */
export function toFormValues(app) {
  if (!app) return EMPTY;
  return Object.fromEntries(
    Object.keys(EMPTY).map((k) => {
      const v = app[k];
      if (v == null) return [k, EMPTY[k]]; // e.g. salaryPeriod falls back to YEARLY, matching the <select>
      if (k === "appliedAt") return [k, v.slice(0, 10)];
      return [k, String(v)];
    }),
  );
}

/** Form strings → API body. Empty strings are sent as-is (the API stores them as null). */
function toPayload(values) {
  const num = (v) => (v.trim() === "" ? null : Number(v.replace(/[,\s]/g, "")));
  return {
    ...values,
    salaryMin: num(values.salaryMin),
    salaryMax: num(values.salaryMax),
    salaryCurrency: values.salaryCurrency.trim().toUpperCase(),
    // No salary at all → don't store a lone period.
    salaryPeriod: values.salaryMin.trim() || values.salaryMax.trim() ? values.salaryPeriod : "",
  };
}

function validate(values) {
  const errors = {};
  if (!values.company.trim()) errors.company = "Company is required";
  if (!values.jobTitle.trim()) errors.jobTitle = "Job title is required";
  if (!values.employmentType) errors.employmentType = "Choose Remote, Hybrid or On-site";
  const { salaryMin, salaryMax } = toPayload(values);
  if (salaryMin != null && !Number.isInteger(salaryMin)) errors.salaryMin = "Use whole numbers";
  if (salaryMax != null && !Number.isInteger(salaryMax)) errors.salaryMax = "Use whole numbers";
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) errors.salaryMax = "Must be at least the minimum";
  if (values.jobUrl && !/^https?:\/\//i.test(values.jobUrl.trim())) errors.jobUrl = "Start with http:// or https://";
  return errors;
}

function Section({ title, children }) {
  return (
    <fieldset className="border-t border-line-subtle pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-4 w-full text-caps font-semibold text-ink-3 uppercase">{title}</legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Pill radio group (Figma "Status" / work-mode chips). `options` = [{ value, label, dot?, on? }]. */
function PillGroup({ legend, name, options, value, onChange, error, className = "" }) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-xs leading-4 font-medium text-ink-2">{legend}</legend>
      <div className="flex flex-wrap gap-2" aria-invalid={Boolean(error)}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-brand-100 ${
              value === o.value
                ? o.on ?? "border-brand-600 bg-brand-50 text-brand-700"
                : o.off ?? `${error ? "border-red-500" : "border-line"} bg-white text-ink-2 hover:bg-subtle`
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={onChange} className="sr-only" />
            {o.dot && <span aria-hidden className="size-1.5 rounded-full" style={{ background: o.dot }} />}
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </fieldset>
  );
}

// Figma: every status pill keeps its colour; unselected ones are faded, the selected one gets an outline.
const STATUS_PILLS = STATUSES.map((s) => ({ ...s, on: `${s.badge} border-current`, off: `${s.badge} border-transparent opacity-60 hover:opacity-100` }));

/**
 * Shared add/edit form. `onSubmit(payload)` must return a promise that rejects with
 * { message, fieldErrors } on failure.
 */
export function ApplicationForm({ initialValues = EMPTY, title, subtitle, submitLabel, onSubmit, asDialog = false }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const field = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(toPayload(values));
    } catch (err) {
      setErrors(err.fieldErrors ?? {});
      setFormError(err.message);
    } finally {
      setSaving(false); // the page may be kept alive after navigating away, so never leave it "saving"
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Discard your changes?")) return;
    router.back();
  }

  // As a dialog (Figma "New application" modal): open it as a native modal so the page behind is inert.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    d.querySelector("input[name=company]")?.focus(); // start typing straight away
    return () => d.open && d.close(); // Next hides visited pages; don't leave a modal open behind
  }, []);

  const form = (
    <form onSubmit={handleSubmit} noValidate className={asDialog ? "" : "card overflow-clip rounded-2xl"}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h1 id="application-form-title" className="text-h2 font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
        </div>
        <button type="button" onClick={cancel} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-subtle">
          <Icon name="x" size={20} />
        </button>
      </div>

      <div className="space-y-5 px-6 pt-6 pb-6">
        {formError && <Alert type="error">{formError}</Alert>}

        <Section title="Job">
          <Input label="Company *" autoComplete="organization" required {...field("company")} />
          <Input label="Job title *" required {...field("jobTitle")} />
          <Input label="Job URL" type="url" icon="link" placeholder="https://…" className="sm:col-span-2" {...field("jobUrl")} />
          <Input label="Location" icon="mapPin" placeholder="e.g. Lagos, Nigeria" {...field("location")} />
          <div>
            <Input label="Source" list="sources" placeholder="Where did you find it?" {...field("source")} />
            <datalist id="sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <PillGroup
            legend="Employment type *"
            name="employmentType"
            options={EMPLOYMENT_TYPES}
            value={values.employmentType}
            onChange={field("employmentType").onChange}
            error={errors.employmentType}
          />
          <Select label="Job type" placeholder="—" options={JOB_TYPES} {...field("jobType")} />
        </Section>

        <Section title="Salary">
          <div>
            <Input label="Currency" list="currencies" placeholder="USD" maxLength={3} {...field("salaryCurrency")} />
            <datalist id="currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <Select label="Period" options={SALARY_PERIODS} {...field("salaryPeriod")} />
          <Input label="Minimum" icon="banknote" inputMode="numeric" placeholder="70000" {...field("salaryMin")} />
          <Input label="Maximum" icon="banknote" inputMode="numeric" placeholder="90000" {...field("salaryMax")} />
        </Section>

        <Section title="Tracking">
          <PillGroup
            legend="Status"
            name="status"
            options={STATUS_PILLS}
            value={values.status}
            onChange={field("status").onChange}
            className="sm:col-span-2"
          />
          <Input
            label="Date applied"
            type="date"
            hint="Left empty, it's set to today when the status moves past Saved."
            {...field("appliedAt")}
          />
          <Select label="Priority" options={PRIORITIES} {...field("priority")} />
        </Section>

        <fieldset className="space-y-4 border-t border-line-subtle pt-5">
          <legend className="float-left mb-4 w-full text-caps font-semibold text-ink-3 uppercase">Details</legend>
          <Textarea label="Job description" rows={6} placeholder="Paste the job description…" className="clear-both" {...field("jobDescription")} />
          <Textarea label="Notes" rows={3} placeholder="Contacts, salary expectations, anything to remember…" {...field("notes")} />
        </fieldset>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-6 py-4">
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>Cancel</Button>
        <Button type="submit" icon="check" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );

  if (!asDialog) return form;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="application-form-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: same as Cancel (asks before discarding changes)
        cancel();
      }}
      className="m-auto max-h-[calc(100vh-4rem)] w-[calc(100%-2rem)] max-w-[600px] overflow-y-auto rounded-2xl p-0 text-ink shadow-pop backdrop:bg-slate-900/40"
    >
      {form}
    </dialog>
  );
}
