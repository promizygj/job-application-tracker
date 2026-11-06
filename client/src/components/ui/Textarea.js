import { useId } from "react";
import { errorFieldClass, labelClass } from "./fieldStyles";

export function Textarea({ label, error, hint, className = "", ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`field py-2.5 leading-5 ${error ? errorFieldClass : ""}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}
