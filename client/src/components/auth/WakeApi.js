"use client";

import { useEffect } from "react";
import { wakeApi } from "@/lib/api";

/**
 * The API runs on a free host that sleeps when idle and takes ~45s to wake. Pinging it as soon as
 * a sign-in/sign-up page opens means it is usually awake by the time the form is submitted.
 */
export function WakeApi() {
  useEffect(() => wakeApi(), []);
  return null;
}
