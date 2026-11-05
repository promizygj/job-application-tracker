"use client";

import { Button } from "./Button";
import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} dismissable={!loading}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button onClick={onConfirm} loading={loading} className={danger ? "bg-red-600 hover:bg-red-500 disabled:bg-red-400" : ""}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
