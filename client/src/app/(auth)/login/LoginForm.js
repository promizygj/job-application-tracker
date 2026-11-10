"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { LabelledDivider } from "@/components/auth/AuthHeading";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SERVER_WAKING_MESSAGE } from "@/lib/api";
import { collectErrors, emailError, focusFirstError, requiredError } from "@/lib/validation";

const ERRORS = {
  rate_limited: "Too many failed attempts. Please wait 15 minutes and try again.",
  invalid_credentials: "Invalid email or password.",
  unavailable: SERVER_WAKING_MESSAGE,
};

/** Only allow redirects back to this site (Auth.js passes an absolute URL). */
function safeCallback(url) {
  if (!url) return "/dashboard";
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin === window.location.origin && target.pathname !== "/login") {
      return target.pathname + target.search;
    }
  } catch {}
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const invalid = collectErrors({
      email: emailError(form.get("email")),
      password: requiredError(form.get("password"), "Enter your password"),
    });
    setFieldErrors(invalid ?? {});
    if (invalid) {
      focusFirstError(e.currentTarget, invalid);
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    if (res?.error) {
      setError(ERRORS[res.code] ?? ERRORS.invalid_credentials);
      setLoading(false);
      return;
    }
    router.replace(safeCallback(params.get("callbackUrl")));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {params.get("reset") && <Alert type="success">Password updated. Log in with your new password.</Alert>}
      {params.get("signedout") === "all" && <Alert type="info">You&apos;ve been signed out on every device.</Alert>}
      {params.get("deleted") && <Alert type="info">Your account and all its data have been deleted.</Alert>}
      {error && <Alert type="error">{error}</Alert>}
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors.password}
        labelAction={
          <Link href="/forgot-password" className="text-brand-600 hover:underline">
            Forgot password?
          </Link>
        }
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">Log in</Button>
      <LabelledDivider>New to JobTrack?</LabelledDivider>
      <ButtonLink href="/register" variant="secondary" size="lg" className="w-full">Create an account</ButtonLink>
    </form>
  );
}
