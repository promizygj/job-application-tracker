"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { removeToast } from "@/store/uiSlice";

function Toast({ toast }) {
  const dispatch = useDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(removeToast(toast.id)), 4000);
    return () => clearTimeout(t);
  }, [dispatch, toast.id]);

  const color = toast.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800";
  return (
    <div className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${color}`}>
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => dispatch(removeToast(toast.id))} aria-label="Dismiss" className="opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

export function Toaster() {
  const toasts = useSelector((s) => s.ui.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}
