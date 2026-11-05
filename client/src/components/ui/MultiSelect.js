"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** Dropdown with checkboxes. `value` is an array of selected option values. */
export function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();

  // Close when the page is hidden by navigation (Next keeps visited pages alive).
  useLayoutEffect(() => () => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={`inline-flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm sm:w-auto ${
          value.length ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white"
        }`}
      >
        {label}
        {value.length > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{value.length}</span>}
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <fieldset id={id} className="absolute z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <legend className="sr-only">{label}</legend>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="accent-indigo-600" />
              {o.label}
            </label>
          ))}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-50">
              Clear selection
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
