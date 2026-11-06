import Link from "next/link";
import { Icon } from "./Icon";

const variants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
  secondary: "border border-line bg-white text-ink hover:bg-subtle disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink disabled:text-ink-3",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-700/50",
};
const sizes = { md: "h-9 px-3.5", lg: "h-11 px-3.5", sm: "h-8 px-3 text-xs" };

export const buttonClass = (variant = "primary", size = "md", className = "") =>
  `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`;

/** Button from the Figma "Button" component. `icon` is an Icon name shown before the label. */
export function Button({ variant = "primary", size = "md", icon, loading = false, className = "", children, ...props }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} size={16} />
      )}
      {children}
    </button>
  );
}

/** A link that looks like a Button. */
export function ButtonLink({ variant = "primary", size = "md", icon, className = "", children, ...props }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Link>
  );
}
