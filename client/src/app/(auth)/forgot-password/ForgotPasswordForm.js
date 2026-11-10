"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, getErrorMessage } from "@/lib/api";
import { emailError } from "@/lib/validation";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [emailErr, setEmailErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const email = new FormData(e.currentTarget).get("email");
    const invalid = emailError(email);
    setEmailErr(invalid);
    if (invalid) {
      e.currentTarget.elements.email.focus();
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert type="success">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</Alert>
        <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:underline">Back to log in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert type="error">{error}</Alert>}
      <Input label="Email" name="email" type="email" autoComplete="email" required error={emailErr} />
      <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
      <Link href="/login" className="block text-center text-sm text-brand-600 hover:underline">Back to log in</Link>
    </form>
  );
}
