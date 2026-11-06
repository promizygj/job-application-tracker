"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { api, getErrorMessage } from "@/lib/api";

export function ConfirmEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState(token ? { status: "loading" } : { status: "error", message: "This link is missing its token." });
  const started = useRef(false);

  useEffect(() => {
    // Links are single-use, so guard against React running the effect twice in dev.
    if (!token || started.current) return;
    started.current = true;
    api
      .post("/auth/confirm-email-change", { token })
      .then((res) => setState({ status: "success", email: res.data.data.user.email }))
      .catch((err) => setState({ status: "error", message: getErrorMessage(err) }));
  }, [token]);

  if (state.status === "loading") return <p className="text-sm text-ink-2">Confirming…</p>;

  return (
    <div className="space-y-4">
      {state.status === "success" ? (
        <Alert type="success">
          Done. Your JobTrack email is now <strong>{state.email}</strong>. Use it next time you log in.
        </Alert>
      ) : (
        <Alert type="error">{state.message} You can request a new link from Settings → Profile.</Alert>
      )}
      <Link href="/settings/profile" className="block text-center text-sm font-medium text-brand-600 hover:underline">
        Go to settings
      </Link>
    </div>
  );
}
