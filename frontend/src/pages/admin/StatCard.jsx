import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/** Shared stat card used across the admin pages. */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "bg-brand-50 text-brand-700",
  trend,
  hint,
  index = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
          <Icon size={21} />
        </span>

        {trend !== undefined && trend !== null && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
              trend > 0
                ? "bg-brand-50 text-brand-700"
                : trend < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-sand-100 text-sand-600"
            }`}
          >
            {trend > 0 ? (
              <TrendingUp size={13} />
            ) : trend < 0 ? (
              <TrendingDown size={13} />
            ) : (
              <Minus size={13} />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      <p className="mt-4 font-display text-2xl font-bold text-sand-900">{value}</p>
      <p className="mt-0.5 text-sm text-sand-500">{label}</p>

      {hint && <p className="mt-2 text-xs text-sand-400">{hint}</p>}
    </motion.div>
  );
}
