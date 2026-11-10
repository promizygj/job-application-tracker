"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { SESSION_IDLE_MS, SESSION_RENEW_MS } from "@/lib/session";

// Shared by every open tab, so activity in one keeps the others signed in too.
const STORAGE_KEY = "jobtrack:lastActivity";
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
const WRITE_EVERY_MS = 5_000;

const readShared = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeShared = (t) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(t));
  } catch {}
};

/**
 * Signs the user out after SESSION_IDLE_MS without interaction, and keeps the server session
 * (which expires after the same idle time) renewed while they are active. Renders nothing.
 */
export function IdleLogout() {
  useEffect(() => {
    let lastActivity = Date.now(); // this page was just served, so the session is fresh
    let lastWrite = 0;
    let lastRenew = Date.now();
    let timer;
    let done = false;

    writeShared(lastActivity);

    const idleFor = () => Date.now() - Math.max(lastActivity, readShared());

    const expire = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const back = window.location.pathname + window.location.search;
      signOut({ redirectTo: `/login?expired=1&callbackUrl=${encodeURIComponent(back)}` });
    };

    // Timers are paused or delayed while a laptop sleeps, so also re-check on focus/visibility.
    const check = () => {
      if (done) return;
      const idle = idleFor();
      if (idle >= SESSION_IDLE_MS) return expire();
      clearTimeout(timer);
      timer = setTimeout(check, SESSION_IDLE_MS - idle + 250);
    };

    const onActivity = () => {
      if (done) return;
      // Coming back after the limit: the first click must not bring the session back to life.
      if (idleFor() >= SESSION_IDLE_MS) return expire();
      const now = Date.now();
      lastActivity = now;
      if (now - lastWrite > WRITE_EVERY_MS) {
        lastWrite = now;
        writeShared(now);
      }
      if (now - lastRenew > SESSION_RENEW_MS) {
        lastRenew = now;
        // Auth.js re-issues the session cookie with a fresh expiry when the session is read.
        fetch("/api/auth/session", { cache: "no-store" }).catch(() => {});
      }
    };

    const onVisible = () => document.visibilityState === "visible" && check();

    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    check();

    return () => {
      clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
