"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Spinner } from "@/components/ui/States";
import { allTimeZones, browserTimeZone } from "@/lib/time";
import { getApiError, useGetMeQuery, useRequestEmailChangeMutation, useResendVerificationMutation, useUpdateMeMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

export function Card({ title, description, children, tone = "default" }) {
  return (
    <section className={`rounded-lg border bg-white p-4 sm:p-6 ${tone === "danger" ? "border-red-200" : "border-slate-200"}`}>
      <h2 className={`font-semibold ${tone === "danger" ? "text-red-700" : ""}`}>{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileForm({ me }) {
  const toast = useToast();
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const initial = { name: me.name, headline: me.headline ?? "", location: me.location ?? "", timezone: me.timezone };
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [zones] = useState(() => {
    const list = allTimeZones();
    return list.includes(me.timezone) ? list : [me.timezone, ...list];
  });
  const deviceTz = browserTimeZone();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const field = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  async function submit(e) {
    e.preventDefault();
    if (!values.name.trim()) return setErrors({ name: "Name is required" });
    setErrors({});
    try {
      await updateMe({ ...values, name: values.name.trim() }).unwrap();
      toast("Profile saved");
    } catch (err) {
      const { message, fieldErrors } = getApiError(err);
      setErrors(fieldErrors);
      toast(message, "error");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Input label="Name *" autoComplete="name" {...field("name")} />
      <Input label="Headline" placeholder="e.g. Frontend developer" maxLength={160} {...field("headline")} />
      <Input label="Location" placeholder="e.g. Lagos, Nigeria" maxLength={100} {...field("location")} />
      <div>
        <Select label="Time zone" options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))} {...field("timezone")} />
        {values.timezone !== deviceTz && zones.includes(deviceTz) ? (
          <button type="button" onClick={() => setValues((v) => ({ ...v, timezone: deviceTz }))} className="mt-1 text-xs text-indigo-600 hover:underline">
            Use this device&apos;s time zone ({deviceTz.replace(/_/g, " ")})
          </button>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Interview times and weekly stats use this zone.</p>
        )}
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={isLoading} disabled={!dirty}>Save profile</Button>
      </div>
    </form>
  );
}

function EmailSection({ me }) {
  const toast = useToast();
  const [requestEmailChange, { isLoading }] = useRequestEmailChangeMutation();
  const [resend, { isLoading: resending }] = useResendVerificationMutation();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ newEmail: "", password: "" });
  const [errors, setErrors] = useState({});
  const [sentTo, setSentTo] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.newEmail.trim())) errs.newEmail = "Enter a valid email";
    if (!values.password) errs.password = "Enter your current password";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await requestEmailChange({ newEmail: values.newEmail.trim(), password: values.password }).unwrap();
      setSentTo(values.newEmail.trim().toLowerCase());
      setOpen(false);
      setValues({ newEmail: "", password: "" });
    } catch (err) {
      const { message, fieldErrors } = getApiError(err);
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { newEmail: message });
    }
  }

  async function resendVerification() {
    try {
      await resend().unwrap();
      toast("Verification email sent");
    } catch (err) {
      toast(getApiError(err).message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{me.email}</span>
        {me.emailVerified ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 ring-inset">Verified</span>
        ) : (
          <>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">Not verified</span>
            <button onClick={resendVerification} disabled={resending} className="text-xs text-indigo-600 hover:underline">Resend verification email</button>
          </>
        )}
        {!open && (
          <button onClick={() => setOpen(true)} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Change email
          </button>
        )}
      </div>
      {/* Hide once the change has gone through (the link was clicked). */}
      {sentTo && sentTo !== me.email && (
        <Alert type="success">
          We sent a confirmation link to <strong>{sentTo}</strong>. Your email changes once you click it. Until then you keep signing in with {me.email}.
        </Alert>
      )}
      {open && (
        <form onSubmit={submit} noValidate className="grid gap-4 rounded-md bg-slate-50 p-4 sm:grid-cols-2">
          <Input
            label="New email"
            type="email"
            autoComplete="email"
            value={values.newEmail}
            error={errors.newEmail}
            onChange={(e) => setValues((v) => ({ ...v, newEmail: e.target.value }))}
          />
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            error={errors.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isLoading}>Send confirmation link</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ProfileSettings() {
  const { data: me, isError, refetch } = useGetMeQuery();
  if (isError) return <ErrorState message="Couldn't load your profile." onRetry={refetch} />;
  if (!me) return <Spinner />;
  return (
    <div className="space-y-6">
      <Card title="Profile" description="How you appear in JobTrack.">
        {/* key: reset the form to the saved values whenever they change */}
        <ProfileForm key={`${me.name}|${me.headline}|${me.location}|${me.timezone}`} me={me} />
      </Card>
      <Card title="Email" description="Used to sign in and for verification and password-reset emails.">
        <EmailSection me={me} />
      </Card>
    </div>
  );
}
