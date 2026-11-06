"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { api, getErrorMessage } from "@/lib/api";

const UNLOCKS = [
  { icon: "file", label: "Uploading résumés and cover letters" },
  { icon: "calendar", label: "Interview details in one place" },
  { icon: "alert", label: "Password reset by email" },
];

const STATES = {
  loading: { icon: "mail", tone: "bg-brand-50 text-brand-600 ring-brand-50/60", title: "Verifying your email…" },
  success: { icon: "check", tone: "bg-emerald-50 text-emerald-600 ring-emerald-50/60", title: "Email verified" },
  error: { icon: "alert", tone: "bg-red-50 text-red-600 ring-red-50/60", title: "Link didn’t work" },
};

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

  const s = STATES[state.status];

  return (
    <div className="flex flex-col items-center text-center">
      <span className={`grid size-[72px] place-items-center rounded-full ring-8 ${s.tone}`}>
        <Icon name={s.icon} size={32} />
      </span>
      <h1 className="mt-6 text-h1 font-semibold text-ink">{s.title}</h1>
      <p role="status" className="mt-2 text-sm leading-5 text-ink-2">
        {state.status === "loading"
          ? "Hang on a moment while we check your link."
          : state.status === "success"
            ? "Your email is verified. Thanks!"
            : `${state.message} You can request a new link from your dashboard.`}
      </p>

      {state.status !== "loading" && (
        <>
          {state.status === "success" && (
            <div className="mt-6 w-full rounded-xl border border-line bg-canvas p-4 text-left">
              <p className="text-caps font-semibold text-ink-3 uppercase">Verifying unlocks</p>
              <ul className="mt-3 space-y-3">
                {UNLOCKS.map((u) => (
                  <li key={u.label} className="flex items-center gap-2.5 text-sm leading-5 text-ink">
                    <Icon name={u.icon} size={16} className="text-brand-600" />
                    {u.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ButtonLink href="/dashboard" size="lg" className="mt-6 w-full">
            {state.status === "success" ? "Continue to dashboard" : "Go to dashboard"}
          </ButtonLink>
        </>
      )}
    </div>
  );
}
