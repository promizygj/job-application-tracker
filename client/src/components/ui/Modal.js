"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Icon } from "./Icon";

/**
 * Accessible modal on the native <dialog>: focus is trapped, Esc closes, the page behind is inert.
 * Clicking the backdrop closes it too (unless `dismissable` is false, e.g. while saving).
 */
export function Modal({ open, onClose, title, children, dismissable = true, size = "max-w-md" }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Next keeps visited pages alive; don't come back to a page with a modal still open.
  useLayoutEffect(() => () => onCloseRef.current?.(), []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? "modal-title" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && dismissable) onClose(); // click on the backdrop
      }}
      className={`m-auto w-[calc(100%-2rem)] ${size} rounded-2xl p-0 text-ink shadow-pop backdrop:bg-slate-900/40`}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          {title && (
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 id="modal-title" className="text-h2 font-semibold">{title}</h2>
              {dismissable && (
                <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-subtle">
                  <Icon name="x" size={20} />
                </button>
              )}
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
