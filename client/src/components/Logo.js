/* eslint-disable @next/next/no-img-element -- tiny static SVGs, no optimisation needed */

/** JobTrack logo. `tone="light"` is the white mark used on the purple auth brand panel. */
export function Logo({ className = "", tone = "default" }) {
  const light = tone === "light";
  return (
    <span className={`inline-flex items-center gap-2.5 text-base leading-6 font-semibold ${light ? "text-white" : "text-ink"} ${className}`}>
      {light ? (
        <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-white">
          <img src="/logo-diamond-brand.svg" alt="" width={14} height={14} />
        </span>
      ) : (
        <img src="/logo-mark.svg" alt="" aria-hidden width={30} height={30} />
      )}
      JobTrack
    </span>
  );
}
