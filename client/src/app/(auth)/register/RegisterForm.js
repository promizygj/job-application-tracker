"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, getErrorMessage, getFieldErrors } from "@/lib/api";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = { name: form.get("name"), email: form.get("email"), password: form.get("password") };
    try {
      await api.post("/auth/register", body);
    } catch (err) {
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
      setLoading(false);
      return;
    }
    // Account created — sign straight in.
    const res = await signIn("credentials", { email: body.email, password: body.password, redirect: false });
    if (res?.error) {
      router.replace("/login");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert type="error">{error}</Alert>}
      <Input label="Name" name="name" autoComplete="name" required error={fieldErrors.name} />
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters, with a letter and a number."
        error={fieldErrors.password}
      />
      <Button type="submit" loading={loading} className="w-full">Create account</Button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
      </p>
    </form>
  );
}
