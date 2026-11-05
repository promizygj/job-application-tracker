"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { api, getErrorMessage } from "@/lib/api";

export function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState(token ? { status: "loading" } : { status: "error", message: "This link is missing its token." });
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use, so guard against React running the effect twice in dev.
    if (!token || started.current) return;
    started.current = true;
    api
      .post("/auth/verify-email", { token })
      .then(() => setState({ status: "success" }))
      .catch((err) => setState({ status: "error", message: getErrorMessage(err) }));
  }, [token]);

  if (state.status === "loading") return <p className="text-sm text-slate-600">Verifying your email…</p>;

  return (
    <div className="space-y-4">
      {state.status === "success" ? (
        <Alert type="success">Your email is verified. Thanks!</Alert>
      ) : (
        <Alert type="error">{state.message} You can request a new link from your dashboard.</Alert>
      )}
      <Link href="/dashboard" className="block text-center text-sm font-medium text-indigo-600 hover:underline">
        Go to dashboard
      </Link>
    </div>
  );
}
