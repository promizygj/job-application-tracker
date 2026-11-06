"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { getApiError, useGetMeQuery, useResendVerificationMutation } from "@/store/apiSlice";

export function VerifyEmailBanner() {
  const { data: user } = useGetMeQuery();
  const [resendVerification] = useResendVerificationMutation();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [hidden, setHidden] = useState(false);

  if (!user || user.emailVerified || hidden) return null;

  async function resend() {
    setStatus("sending");
    try {
      await resendVerification().unwrap();
      setStatus("sent");
    } catch (err) {
      setMessage(getApiError(err).message);
      setStatus("error");
    }
  }

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-[10px] border border-amber-200 bg-amber-50 py-3 pr-3 pl-4">
      <Icon name="alert" size={18} className="text-amber-600" />
      <p className="min-w-0 flex-1 text-sm leading-5 text-amber-800">
        {status === "sent" ? (
          <>New link sent to <strong className="font-medium">{user.email}</strong> — check your inbox.</>
        ) : status === "error" ? (
          message
        ) : (
          <>Verify <strong className="font-medium">{user.email}</strong> to unlock document uploads.</>
        )}
      </p>
      {status !== "sent" && (
        <button
          onClick={resend}
          disabled={status === "sending"}
          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs leading-4 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Resend email"}
        </button>
      )}
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="grid size-7 place-items-center rounded-lg text-amber-700 hover:bg-amber-100">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
