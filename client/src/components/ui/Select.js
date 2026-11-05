import { useId } from "react";

/** Labelled <select>. `options` = [{ value, label }]. */
export function Select({ label, error, options, placeholder, className = "", hideLabel = false, ...props }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className={hideLabel ? "sr-only" : "mb-1 block text-sm font-medium text-slate-700"}>
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus:ring-2 ${
          error ? "border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
        }`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
