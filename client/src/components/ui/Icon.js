/**
 * Icons from the Figma "Icons" frame (public/icons/*.svg), drawn as a CSS mask so they take the
 * current text colour. Decorative by default; pass `label` when the icon is the only content.
 */
export function Icon({ name, size = 20, className = "", label }) {
  const url = `url(/icons/${name}.svg)`;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ width: size, height: size, mask: `${url} center / contain no-repeat`, WebkitMask: `${url} center / contain no-repeat` }}
    />
  );
}
