"use client";

import axios from "axios";
import { signOut } from "next-auth/react";

/** Browser-side API client. Requests go to /api/v1 on this origin and are proxied to Express. */
export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Session revoked server-side (logout-all, password change): clear the Auth.js cookie too.
    if (error.response?.status === 401 && typeof window !== "undefined") {
      signOut({ redirectTo: "/login" });
    }
    return Promise.reject(error);
  },
);

export const SERVER_WAKING_MESSAGE = "Our server is starting up. Please wait a few seconds and try again.";

/**
 * True when the request never got a proper answer from the API: no response at all, or a
 * gateway error while the (free-tier) server wakes from sleep.
 */
export function isServerUnavailable(error) {
  const status = error?.response?.status;
  return !error?.response || [502, 503, 504].includes(status);
}

export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const message = error?.response?.data?.error?.message;
  if (message) return message;
  return isServerUnavailable(error) ? SERVER_WAKING_MESSAGE : fallback;
}

/** Fire-and-forget request that wakes a sleeping API while the user is still filling in a form. */
export function wakeApi() {
  fetch("/api/v1/health", { cache: "no-store" }).catch(() => {});
}

/** Maps API validation details to { fieldName: message }, keeping the first message for each field. */
export function getFieldErrors(error) {
  return firstPerField(error?.response?.data?.error?.details);
}

export function firstPerField(details = []) {
  const out = {};
  for (const d of details) out[d.path] ??= d.message;
  return out;
}
