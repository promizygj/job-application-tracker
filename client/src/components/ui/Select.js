import { useId } from "react";
import { Icon } from "./Icon";
import { errorFieldClass, labelClass } from "./fieldStyles";

/** Labelled <select> styled like the Figma TextField, with the chevron icon. `options` = [{ value, label }]. */
export function Select({ label, error, options, placeholder, className = "", hideLabel = false, size = "md", ...props }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className={hideLabel ? "sr-only" : labelClass}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`field appearance-none pr-9 ${size === "sm" ? "h-9" : "h-10"} ${error ? errorFieldClass : ""}`}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
