"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ERRORS = {
  rate_limited: "Too many failed attempts. Please wait 15 minutes and try again.",
  invalid_credentials: "Invalid email or password.",
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
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {params.get("reset") && <Alert type="success">Password updated. Log in with your new password.</Alert>}
      {params.get("signedout") === "all" && <Alert type="info">You&apos;ve been signed out on every device.</Alert>}
      {params.get("deleted") && <Alert type="info">Your account and all its data have been deleted.</Alert>}
      {error && <Alert type="error">{error}</Alert>}
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <div>
        <Input label="Password" name="password" type="password" autoComplete="current-password" required />
        <Link href="/forgot-password" className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={loading} className="w-full">Log in</Button>
      <p className="text-center text-sm text-slate-600">
        No account?{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">Create one</Link>
      </p>
    </form>
  );
}
