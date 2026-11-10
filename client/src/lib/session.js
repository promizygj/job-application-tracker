// How long a signed-in session survives without any activity. Used by Auth.js (cookie/JWT expiry,
// renewed on activity) and by <IdleLogout> (signs out an open tab when the time is up).
export const SESSION_IDLE_MINUTES = 60;
export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;

/** While the user is active, renew the session cookie at most this often. */
export const SESSION_RENEW_MS = 2 * 60 * 1000;

/** "1 hour", "2 hours", "30 minutes": for messages to the user. */
export const SESSION_IDLE_LABEL =
  SESSION_IDLE_MINUTES % 60 === 0
    ? `${SESSION_IDLE_MINUTES / 60} hour${SESSION_IDLE_MINUTES === 60 ? "" : "s"}`
    : `${SESSION_IDLE_MINUTES} minutes`;
