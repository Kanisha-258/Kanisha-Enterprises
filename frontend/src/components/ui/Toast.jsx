import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

const STYLES = {
  success: {
    icon: CheckCircle2,
    bar: "bg-brand-500",
    ring: "ring-brand-200",
    tint: "text-brand-700",
  },
  error: {
    icon: XCircle,
    bar: "bg-red-500",
    ring: "ring-red-200",
    tint: "text-red-700",
  },
  info: {
    icon: Info,
    bar: "bg-sky-500",
    ring: "ring-sky-200",
    tint: "text-sky-700",
  },
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info", duration = 3500) => {
      if (!message) return null;

      const id = ++nextId;
      setToasts((current) => [...current, { id, message, type }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      push,
      success: (m, d) => push(m, "success", d),
      error: (m, d) => push(m, "error", d ?? 4500),
      info: (m, d) => push(m, "info", d),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const { icon: Icon, bar, ring, tint } = STYLES[toast.type] ?? STYLES.info;

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-lift ring-1 ${ring}`}
              >
                <span className={`absolute left-0 h-full w-1 ${bar}`} aria-hidden="true" />

                <Icon size={20} className={`mt-0.5 shrink-0 ${tint}`} />

                <p className="flex-1 text-sm font-medium leading-snug text-sand-800">
                  {toast.message}
                </p>

                <button
                  onClick={() => dismiss(toast.id)}
                  className="shrink-0 rounded-lg p-1 text-sand-400 transition hover:bg-sand-100 hover:text-sand-700"
                  aria-label="Dismiss notification"
                >
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Usage: const toast = useToast(); toast.success("Saved!") */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }

  return context;
}

export default ToastProvider;
