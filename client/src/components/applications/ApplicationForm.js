"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
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
    <fieldset className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * Shared add/edit form. `onSubmit(payload)` must return a promise that rejects with
 * { message, fieldErrors } on failure.
 */
export function ApplicationForm({ initialValues = EMPTY, submitLabel, onSubmit }) {
  const router = useRouter();
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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert type="error">{formError}</Alert>}

      <Section title="Job">
        <Input label="Company *" autoComplete="organization" required {...field("company")} />
        <Input label="Job title *" required {...field("jobTitle")} />
        <Input label="Job URL" type="url" placeholder="https://…" className="sm:col-span-2" {...field("jobUrl")} />
        <Input label="Location" placeholder="e.g. Lagos, London" {...field("location")} />
        <div>
          <Input label="Source" list="sources" placeholder="Where did you find it?" {...field("source")} />
          <datalist id="sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <fieldset className="sm:col-span-1">
          <legend className="mb-1 text-sm font-medium text-slate-700">Employment type *</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-invalid={Boolean(errors.employmentType)}>
            {EMPLOYMENT_TYPES.map((t) => (
              <label
                key={t.value}
                className={`cursor-pointer rounded-md border px-3 py-2 text-sm has-checked:border-indigo-500 has-checked:bg-indigo-50 has-checked:text-indigo-700 has-focus-visible:ring-2 has-focus-visible:ring-indigo-200 ${
                  errors.employmentType ? "border-red-500" : "border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="employmentType"
                  value={t.value}
                  checked={values.employmentType === t.value}
                  onChange={field("employmentType").onChange}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </div>
          {errors.employmentType && <p className="mt-1 text-sm text-red-600">{errors.employmentType}</p>}
        </fieldset>
        <Select label="Job type" placeholder="—" options={JOB_TYPES} {...field("jobType")} />
      </Section>

      <Section title="Salary">
        <div>
          <Input label="Currency" list="currencies" placeholder="USD" maxLength={3} {...field("salaryCurrency")} />
          <datalist id="currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <Select label="Period" options={SALARY_PERIODS} {...field("salaryPeriod")} />
        <Input label="Minimum" inputMode="numeric" placeholder="70000" {...field("salaryMin")} />
        <Input label="Maximum" inputMode="numeric" placeholder="90000" {...field("salaryMax")} />
      </Section>

      <Section title="Status">
        <Select label="Status" options={STATUSES} {...field("status")} />
        <Input
          label="Applied on"
          type="date"
          hint="Left empty, it's set to today when the status moves past Saved."
          {...field("appliedAt")}
        />
        <Select label="Priority" options={PRIORITIES} {...field("priority")} />
      </Section>

      <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <legend className="px-1 text-sm font-semibold text-slate-900">Details</legend>
        <Textarea label="Job description" rows={8} placeholder="Paste the job description…" {...field("jobDescription")} />
        <Textarea label="Notes" rows={4} placeholder="Contacts, salary expectations, anything to remember…" {...field("notes")} />
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="button" variant="secondary" onClick={cancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
