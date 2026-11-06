"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Spinner } from "@/components/ui/States";
import { allTimeZones, browserTimeZone } from "@/lib/time";
import { getApiError, useGetMeQuery, useRequestEmailChangeMutation, useResendVerificationMutation, useUpdateMeMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";

/** Settings section (Figma): header with title + description, body, optional grey footer for actions. */
export function Card({ title, description, children, footer, tone = "default", as: Tag = "section", ...props }) {
  return (
    <Tag className="card overflow-hidden" {...props}>
      <div className="border-b border-line-subtle px-6 py-5">
        <h2 className={`text-base leading-6 font-semibold ${tone === "danger" ? "text-red-700" : "text-ink"}`}>{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-4 text-ink-2">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line-subtle bg-canvas px-6 py-4">{footer}</div>}
    </Tag>
  );
}

/** Title + description on the left, control on the right (Figma settings rows). */
export function Row({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm leading-5 font-semibold text-ink">{title}</p>
        {description && <p className="text-xs leading-4 text-ink-2">{description}</p>}
      </div>
      {children}
    </div>
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
    <Card
      as="form"
      onSubmit={submit}
      noValidate
      title="Profile"
      description="Your personal details. Only you can see this."
      footer={
        <>
          <Button type="button" variant="secondary" disabled={!dirty || isLoading} onClick={() => setValues(initial)}>Cancel</Button>
          <Button type="submit" loading={isLoading} disabled={!dirty}>Save changes</Button>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-4">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
          {me.name?.[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm leading-5 font-semibold text-ink">{me.name}</p>
          <p className="truncate text-xs leading-4 text-ink-3">{me.headline || me.email}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name *" autoComplete="name" {...field("name")} />
        <Input label="Headline" placeholder="e.g. Frontend developer" maxLength={160} {...field("headline")} />
        <Input label="Location" icon="mapPin" placeholder="e.g. Lagos, Nigeria" maxLength={100} {...field("location")} />
        <div>
          <Select label="Time zone" options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))} {...field("timezone")} />
          {values.timezone !== deviceTz && zones.includes(deviceTz) ? (
            <button type="button" onClick={() => setValues((v) => ({ ...v, timezone: deviceTz }))} className="mt-1.5 text-xs text-brand-600 hover:underline">
              Use this device&apos;s time zone ({deviceTz.replace(/_/g, " ")})
            </button>
          ) : (
            <p className="mt-1.5 text-xs text-ink-3">Interview times and weekly stats use this zone.</p>
          )}
        </div>
      </div>
    </Card>
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs leading-4 font-medium text-ink-2">Email</p>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{me.email}</span>
            {me.emailVerified ? (
              <Pill className="bg-emerald-100 text-emerald-700" dot="#10b981">Verified</Pill>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Icon name="alert" size={12} />
                Unverified
              </span>
            )}
          </div>
        </div>
        {!open && (
          <Button variant="secondary" onClick={() => setOpen(true)} className="h-10">
            Change email
          </Button>
        )}
      </div>
      {!me.emailVerified && (
        <p className="-mt-2 text-xs text-ink-3">
          Didn&apos;t get the email?{" "}
          <button onClick={resendVerification} disabled={resending} className="font-medium text-brand-600 hover:underline">
            Resend verification
          </button>
        </p>
      )}
      {/* Hide once the change has gone through (the link was clicked). */}
      {sentTo && sentTo !== me.email && (
        <Alert type="success">
          We sent a confirmation link to <strong>{sentTo}</strong>. Your email changes once you click it. Until then you keep signing in with {me.email}.
        </Alert>
      )}
      {open && (
        <form onSubmit={submit} noValidate className="grid gap-4 rounded-xl border border-line-subtle bg-canvas p-4 sm:grid-cols-2">
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
      {/* key: reset the form to the saved values whenever they change */}
      <ProfileForm key={`${me.name}|${me.headline}|${me.location}|${me.timezone}`} me={me} />
      <Card title="Email" description="Used to sign in and for verification and password-reset emails.">
        <EmailSection me={me} />
      </Card>
    </div>
  );
}
