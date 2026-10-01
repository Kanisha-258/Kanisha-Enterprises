import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, X } from "lucide-react";

/**
 * A confirmation step for an action that should not happen by accident.
 *
 * Built here rather than with `window.confirm` because two things were missing
 * from the browser dialog:
 *
 * 1. A reason. Cancelling an order should say *why* — for the customer it is
 *    feedback, and for the shop it is the only record of why stock came back.
 * 2. Control over what happens on success and failure, so the page can refresh
 *    and report a server-side rejection in the project's own toast style.
 *
 * Keyboard and screen-reader behaviour is handled here so every caller gets it:
 * Escape cancels, focus moves to the confirm button, the backdrop is inert to
 * the page behind it, and the dialog is labelled rather than decorative.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Keep it",
  tone = "danger",
  showReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "",
  reasonHint = null,
  busy = false,
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef(null);
  const confirmRef = useRef(null);
  const [reason, setReason] = useState("");

  // Clear a previous attempt's text so reopening does not show stale input —
  // important when the same dialog is reused for a different order.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  // Escape closes, but never mid-flight — cancelling a request that is already
  // being sent would leave the user unsure whether it worked.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) {
        onClose();
        return;
      }

      // Keep Tab inside the dialog. Without this, tabbing walks out to the page
      // behind and the modal is only nominally modal.
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind scrolling under the dialog on touch devices.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    confirmRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onClose]);

  const isDanger = tone === "danger";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !busy && onClose()}
            className="absolute inset-0 bg-sand-900/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
          >
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-sand-400 transition hover:bg-sand-100 hover:text-sand-700 disabled:opacity-40"
            >
              <X size={17} />
            </button>

            <h2
              id="confirm-dialog-title"
              className="pr-8 font-display text-lg font-bold text-sand-900"
            >
              {title}
            </h2>

            <p
              id="confirm-dialog-description"
              className="mt-2 text-sm leading-relaxed text-sand-600"
            >
              {description}
            </p>

            {showReason && (
              <div className="mt-5">
                <label
                  htmlFor="confirm-dialog-reason"
                  className="block text-xs font-bold uppercase tracking-wider text-sand-500"
                >
                  {reasonLabel}
                </label>

                <textarea
                  id="confirm-dialog-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={reasonPlaceholder}
                  maxLength={300}
                  className="mt-2 w-full resize-none rounded-xl border border-sand-200 px-4 py-2.5 text-sm text-sand-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />

                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs text-sand-500">{reasonHint}</p>
                  <p className="shrink-0 text-xs tabular-nums text-sand-400">
                    {reason.length}/300
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl border border-sand-300 bg-white px-5 py-3 text-sm font-semibold text-sand-700 transition hover:bg-sand-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>

              <button
                ref={confirmRef}
                onClick={() => onConfirm(reason)}
                disabled={busy}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-60 ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-brand-700 hover:bg-brand-800"
                }`}
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}