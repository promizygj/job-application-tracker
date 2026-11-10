"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, getErrorMessage, getFieldErrors } from "@/lib/api";
import { collectErrors, focusFirstError, newPasswordError } from "@/lib/validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert type="error">This reset link is missing its token.</Alert>
        <Link href="/forgot-password" className="block text-center text-sm text-brand-600 hover:underline">Request a new link</Link>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const invalid = collectErrors({
      password: newPasswordError(form.get("password")),
      confirm: !form.get("confirm")
        ? "Confirm your new password"
        : form.get("password") !== form.get("confirm") ? "Passwords don't match" : null,
    });
    setError(null);
    setFieldErrors(invalid ?? {});
    if (invalid) {
      focusFirstError(e.currentTarget, invalid);
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password: form.get("password") });
      router.replace("/login?reset=1");
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert type="error">{error}</Alert>}
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a letter and a number."
        error={fieldErrors.password}
      />
      <Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" required error={fieldErrors.confirm} />
      <Button type="submit" loading={loading} className="w-full">Update password</Button>
    </form>
  );
}
