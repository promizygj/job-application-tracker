"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { ErrorState, Spinner } from "@/components/ui/States";
import { getApiError, useChangePasswordMutation, useDeleteAccountMutation, useGetMeQuery, useLogoutAllMutation } from "@/store/apiSlice";
import { useToast } from "@/store/hooks";
import { Card, Row } from "./ProfileSettings";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

function ChangePassword({ me }) {
  const toast = useToast();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [signingIn, setSigningIn] = useState(false);

  const field = (name) => ({
    name,
    type: "password",
    value: values[name],
    error: errors[name],
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!values.currentPassword) errs.currentPassword = "Enter your current password";
    if (values.newPassword.length < 8 || !/[A-Za-z]/.test(values.newPassword) || !/\d/.test(values.newPassword)) {
      errs.newPassword = "At least 8 characters, with a letter and a number";
    }
    if (values.confirm !== values.newPassword) errs.confirm = "Passwords don't match";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }).unwrap();
    } catch (err) {
      return setErrors(getApiError(err).fieldErrors);
    }
    // The change signs out every session, including this one. Sign straight back in so only the
    // other devices are logged out.
    setSigningIn(true);
    const res = await signIn("credentials", { email: me.email, password: values.newPassword, redirect: false });
    if (res?.error) {
      await signOut({ redirectTo: "/login" });
      return;
    }
    setSigningIn(false);
    setValues(EMPTY);
    toast("Password changed. Other devices have been signed out.");
  }

  return (
    <form onSubmit={submit} noValidate className="border-b border-line-subtle pb-5">
      <p className="text-sm leading-5 font-semibold text-ink">Password</p>
      <p className="text-xs leading-4 text-ink-2">Changing it signs out your other devices.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Input label="Current password" autoComplete="current-password" {...field("currentPassword")} />
        <Input label="New password" autoComplete="new-password" hint="8+ characters, a letter and a number" {...field("newPassword")} />
        <Input label="Confirm new password" autoComplete="new-password" {...field("confirm")} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="secondary" loading={isLoading || signingIn}>Change password</Button>
      </div>
    </form>
  );
}

function SignOutEverywhere() {
  const toast = useToast();
  const [logoutAll, { isLoading }] = useLogoutAllMutation();
  const [confirming, setConfirming] = useState(false);

  async function confirm() {
    try {
      await logoutAll().unwrap();
      await signOut({ redirectTo: "/login?signedout=all" });
    } catch (err) {
      toast(getApiError(err).message, "error");
      setConfirming(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon="logout" onClick={() => setConfirming(true)}>Sign out everywhere</Button>
      <ConfirmDialog
        open={confirming}
        title="Sign out of every device?"
        confirmLabel="Sign out everywhere"
        loading={isLoading}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      >
        Every browser and device signed in to your account, including this one, will need to log in again.
      </ConfirmDialog>
    </>
  );
}

function DeleteAccount({ me }) {
  const [deleteAccount, { isLoading }] = useDeleteAccountMutation();
  const [typedEmail, setTypedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const emailMatches = typedEmail.trim().toLowerCase() === me.email;

  async function confirm() {
    try {
      await deleteAccount({ password }).unwrap();
      await signOut({ redirectTo: "/login?deleted=1" });
    } catch (err) {
      setError(getApiError(err).message);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm leading-5 font-semibold text-ink">Delete account</p>
        <p className="text-xs leading-4 text-ink-2">
          Permanently deletes your applications, interviews, documents (including the uploaded files) and your account. This can&apos;t be undone.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={`Type ${me.email} to confirm`} autoComplete="off" value={typedEmail} onChange={(e) => setTypedEmail(e.target.value)} />
        <Input
          label="Your password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={error}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => setConfirming(true)}
          disabled={!emailMatches || !password}
          variant="danger"
        >
          Delete my account
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Delete your account permanently?"
        confirmLabel="Yes, delete everything"
        danger
        loading={isLoading}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      >
        All your data and files will be deleted immediately.
      </ConfirmDialog>
    </div>
  );
}

export function SecuritySettings() {
  const { data: me, isError, refetch } = useGetMeQuery();
  if (isError) return <ErrorState message="Couldn't load your account." onRetry={refetch} />;
  if (!me) return <Spinner />;
  return (
    <div className="space-y-6">
      <Card title="Account & security" description="Keep your account secure.">
        <ChangePassword me={me} />
        <div className="pt-5">
          <Row title="Active sessions" description="Lost a device, or signed in on a shared computer? Sign out of JobTrack everywhere.">
            <SignOutEverywhere />
          </Row>
        </div>
      </Card>
      <Card title="Data & privacy" description="Permanently remove your account." tone="danger">
        <DeleteAccount me={me} />
      </Card>
    </div>
  );
}
