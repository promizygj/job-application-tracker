"use client";

import { useId, useState } from "react";
import { errorFieldClass, labelClass } from "./fieldStyles";
import { Icon } from "./Icon";

/**
 * TextField from Figma: 12px label, 40px input. `icon` shows a leading icon, `labelAction` sits on the
 * right of the label row (e.g. "Forgot password?"), and password fields get a show/hide toggle.
 */
export function Input({ label, error, hint, icon, labelAction, className = "", inputClassName = "", type = "text", ...props }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const isPassword = type === "password";

  return (
    <div className={className}>
      {(label || labelAction) && (
        <div className="flex items-start justify-between gap-2">
          {label && <label htmlFor={id} className={labelClass}>{label}</label>}
          {labelAction && <span className="text-xs leading-4 font-medium">{labelAction}</span>}
        </div>
      )}
      <div className="relative">
        {icon && <Icon name={icon} size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />}
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`field h-10 ${icon ? "pl-9" : ""} ${isPassword ? "pr-10" : ""} ${error ? errorFieldClass : ""} ${inputClassName}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide characters" : "Show characters"}
            aria-pressed={reveal}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-subtle hover:text-ink-2"
          >
            <Icon name="eye" size={18} />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700">{error}</p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">{hint}</div>
      ) : null}
    </div>
  );
}
