// Client-side checks that run before a form is sent. They mirror the server rules
// (server/src/modules/auth/auth.schemas.js); the server still validates everything.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value) {
  const v = String(value ?? "").trim();
  if (!v) return "Enter your email";
  if (!EMAIL_RE.test(v)) return "Enter a valid email";
  return null;
}

/** Login only needs a value: an old password may predate today's rules. */
export function requiredError(value, message) {
  return String(value ?? "") ? null : message;
}

/** Rules for a new password (register, reset). */
export function newPasswordError(value) {
  const p = String(value ?? "");
  if (!p) return "Enter a password";
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 72) return "Password must be at most 72 characters";
  if (!/[A-Za-z]/.test(p)) return "Password must contain a letter";
  if (!/[0-9]/.test(p)) return "Password must contain a number";
  return null;
}

/** Drops empty entries; returns null when every field passed. */
export function collectErrors(errors) {
  const found = Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
  return Object.keys(found).length ? found : null;
}

/** Moves focus to the first field (in form order) that has an error. */
export function focusFirstError(form, errors) {
  const first = [...form.elements].find((el) => el.name && errors[el.name]);
  first?.focus();
}
