const styles = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-indigo-200 bg-indigo-50 text-indigo-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function Alert({ type = "info", children, className = "" }) {
  return (
    <div role={type === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles[type]} ${className}`}>
      {children}
    </div>
  );
}
