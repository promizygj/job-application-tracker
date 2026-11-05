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

export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.error?.message ?? fallback;
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
