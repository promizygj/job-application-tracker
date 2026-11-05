export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-indigo-600 text-sm text-white">◆</span>
      JobTrack
    </span>
  );
}
