"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "./Icon";

/** Search input that calls onSearch 300 ms after typing stops. */
export function SearchBox({ value, onSearch, label = "Search", placeholder = "Search company or job title…", className = "" }) {
  const [text, setText] = useState(value);
  const id = useId();

  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text, value, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
      <input
        id={id}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="field h-10 pl-9"
      />
    </div>
  );
}
