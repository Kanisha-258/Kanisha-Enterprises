import { Minus, Plus } from "lucide-react";

export default function QuantityStepper({
  value = 1,
  min = 1,
  max = 99,
  onChange,
  size = "md",
  disabled = false,
}) {
  const set = (next) => onChange?.(Math.max(min, Math.min(max, next)));

  const dims = size === "sm" ? "h-9 text-sm" : "h-11 text-base";
  const btn = size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded-xl border border-sand-200 bg-white ${dims}`}
    >
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= min}
        className={`${btn} grid place-items-center text-sand-600 transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40`}
        aria-label="Decrease quantity"
      >
        <Minus size={size === "sm" ? 14 : 16} />
      </button>

      <span
        className="min-w-9 text-center font-semibold tabular-nums text-sand-900"
        aria-live="polite"
      >
        {value}
      </span>

      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= max}
        className={`${btn} grid place-items-center text-sand-600 transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40`}
        aria-label="Increase quantity"
      >
        <Plus size={size === "sm" ? 14 : 16} />
      </button>
    </div>
  );
}
