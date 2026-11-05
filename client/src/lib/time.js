// Time-zone helpers built on the browser's Intl data (no extra library).

function parts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map(({ type, value }) => [type, value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** How far `timeZone` is ahead of UTC at the instant `utcMs`, in ms. */
function offsetAt(timeZone, utcMs) {
  const p = parts(new Date(utcMs), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Wall-clock date + time in `timeZone` → ISO instant (UTC).
 * e.g. ("2026-11-10", "14:00", "Europe/London") → "2026-11-10T14:00:00.000Z"
 * Two passes so times next to a daylight-saving change resolve correctly.
 */
export function zonedToIso(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let utc = wall - offsetAt(timeZone, wall);
  utc = wall - offsetAt(timeZone, utc);
  return new Date(utc).toISOString();
}

/** ISO instant → { date: "YYYY-MM-DD", time: "HH:MM" } as shown on a clock in `timeZone`. */
export function isoToZoned(iso, timeZone) {
  const p = parts(new Date(iso), timeZone);
  const pad = (n) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export const dayKey = (iso, timeZone) => isoToZoned(iso, timeZone).date;

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function allTimeZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export function formatTime(iso, timeZone) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** "Tue 10 Nov 2026" for a YYYY-MM-DD key. */
export function formatDayKey(key, opts = {}) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC", ...opts }).format(
    new Date(`${key}T00:00:00Z`),
  );
}
