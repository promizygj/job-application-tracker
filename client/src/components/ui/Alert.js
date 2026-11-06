import { Icon } from "./Icon";

const styles = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-brand-100 bg-brand-50 text-brand-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};
const icons = { error: "alert", success: "check", info: "sparkles", warning: "alert" };

export function Alert({ type = "info", children, className = "" }) {
  return (
    <div role={type === "error" ? "alert" : "status"} className={`flex gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-sm leading-5 ${styles[type]} ${className}`}>
      <Icon name={icons[type]} size={16} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
