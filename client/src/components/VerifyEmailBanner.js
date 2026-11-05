"use client";

import { useState } from "react";
import { getApiError, useGetMeQuery, useResendVerificationMutation } from "@/store/apiSlice";

export function VerifyEmailBanner() {
  const { data: user } = useGetMeQuery();
  const [resendVerification] = useResendVerificationMutation();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  if (!user || user.emailVerified) return null;

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
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
      Please verify <strong>{user.email}</strong> to unlock document uploads.{" "}
      {status === "sent" ? (
        <span>New link sent — check your inbox.</span>
      ) : status === "error" ? (
        <span>{message}</span>
      ) : (
        <button onClick={resend} disabled={status === "sending"} className="font-medium underline">
          {status === "sending" ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}
