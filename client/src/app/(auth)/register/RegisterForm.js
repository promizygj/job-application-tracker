"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { api, getErrorMessage, getFieldErrors } from "@/lib/api";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

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
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert type="error">{error}</Alert>}
      <Input label="Full name" name="name" autoComplete="name" required error={fieldErrors.name} />
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={<PasswordChecks password={password} />}
        error={fieldErrors.password}
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">Create account</Button>
      <p className="text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">Log in</Link>
      </p>
    </form>
  );
}

const RULES = [
  { label: "8+ characters", test: (p) => p.length >= 8 },
  { label: "A letter", test: (p) => /[A-Za-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
];

/** Strength bar + checklist under the password (Figma "Create account"). */
function PasswordChecks({ password }) {
  return (
    <div className="space-y-2 pt-0.5">
      <div aria-hidden className="grid grid-cols-4 gap-1">
        {RULES.map((r) => (
          <span key={r.label} className={`h-1 rounded-full ${r.test(password) ? "bg-emerald-500" : "bg-subtle"}`} />
        ))}
        <span className="h-1 rounded-full bg-subtle" />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.label} className={`flex items-center gap-1 font-medium ${ok ? "text-emerald-700" : "text-ink-3"}`}>
              <Icon name="check" size={13} />
              {r.label}
              <span className="sr-only">{ok ? "(done)" : "(needed)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
