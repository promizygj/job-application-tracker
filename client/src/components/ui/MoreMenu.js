"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * The "⋯" button from the Figma cards and table rows. `items` = [{ href, label }].
 * Pointer and key events stop here, so it never starts a drag or follows a row link.
 */
export function MoreMenu({ label, items, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const stop = (e) => e.stopPropagation();

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

  return (
    <div ref={ref} className={`relative z-10 inline-block ${className}`} onPointerDown={stop} onKeyDown={stop}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-subtle hover:text-ink"
      >
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute top-8 right-0 w-40 rounded-xl border border-line bg-white p-1 text-left shadow-pop">
          {items.map((item) => (
            <Link
              key={item.href}
              role="menuitem"
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-subtle hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
