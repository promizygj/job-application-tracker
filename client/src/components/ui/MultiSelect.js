"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

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
        className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm font-medium sm:w-auto ${
          value.length ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-white text-ink"
        }`}
      >
        {label}
        {value.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{value.length}</span>}
        <Icon name="chevronDown" size={16} className="text-ink-3" />
      </button>
      {open && (
        <fieldset id={id} className="absolute z-20 mt-1 w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop">
          <legend className="sr-only">{label}</legend>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="size-4 accent-brand-600" />
              {o.label}
            </label>
          ))}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-2 hover:bg-subtle">
              Clear selection
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
