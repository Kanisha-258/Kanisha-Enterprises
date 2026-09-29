import { motion } from "framer-motion";

/**
 * Friendly "nothing here yet" panel with an optional call to action.
 */
export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  actionLabel,
  className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-sand-300 bg-white/60 px-6 py-16 text-center ${className}`}
    >
      {Icon && (
        <div className="relative">
          {/* Soft pulsing halo behind the icon. */}
          <span className="absolute inset-0 -z-10 rounded-full bg-brand-100" />
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-200/50" />
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon size={30} strokeWidth={1.6} />
          </div>
        </div>
      )}

      <h3 className="mt-6 text-xl font-bold text-sand-900">{title}</h3>

      {message && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-sand-500">{message}</p>
      )}

      {action && actionLabel && (
        <a
          href={action}
          className="btn-shine mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          {actionLabel}
        </a>
      )}
    </motion.div>
  );
}
