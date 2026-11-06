"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Icon } from "@/components/ui/Icon";
import { removeToast } from "@/store/uiSlice";

function Toast({ toast }) {
  const dispatch = useDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(removeToast(toast.id)), 4000);
    return () => clearTimeout(t);
  }, [dispatch, toast.id]);

  const error = toast.type === "error";
  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink shadow-pop">
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${error ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
        <Icon name={error ? "alert" : "check"} size={13} />
      </span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => dispatch(removeToast(toast.id))} aria-label="Dismiss" className="text-ink-3 hover:text-ink">
        <Icon name="x" size={16} />
      </button>
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
