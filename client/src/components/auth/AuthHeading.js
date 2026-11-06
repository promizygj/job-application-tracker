/** Heading block on the auth form side (Figma "heading": H1 + secondary text). */
export function AuthHeading({ title, children, center = false }) {
  return (
    <div className={`mb-5 space-y-2 ${center ? "text-center" : ""}`}>
      <h1 className="text-h1 font-semibold text-ink">{title}</h1>
      {children && <p className="text-sm leading-5 text-ink-2">{children}</p>}
    </div>
  );
}

/** Divider with a label in the middle ("New to JobTrack?"). */
export function LabelledDivider({ children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs leading-4 font-medium text-ink-3">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
