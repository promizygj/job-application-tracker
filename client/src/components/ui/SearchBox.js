"use client";

import { useEffect, useId, useState } from "react";

/** Search input that calls onSearch 300 ms after typing stops. */
export function SearchBox({ value, onSearch, label = "Search", placeholder = "Search company or job title…" }) {
  const [text, setText] = useState(value);
  const id = useId();

  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text, value, onSearch]);

  return (
    <div className="relative flex-1 sm:min-w-64">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">⌕</span>
      <input
        id={id}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-8 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
    </div>
  );
}
