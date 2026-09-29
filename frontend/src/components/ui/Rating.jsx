import { Star } from "lucide-react";

/**
 * Read-only star rating, or an interactive one for the review form.
 */
export default function Rating({
  value = 0,
  count,
  size = 15,
  interactive = false,
  onChange,
  className = "",
}) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));

  if (interactive) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className="rounded p-0.5 transition-transform duration-200 hover:scale-115 focus-visible:scale-110"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            aria-pressed={rating === star}
          >
            <Star
              size={size + 6}
              className={
                star <= rating
                  ? "fill-wheat-400 text-wheat-400"
                  : "fill-transparent text-sand-300"
              }
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = rating >= star;
          const half = !filled && rating >= star - 0.5;

          return (
            <span key={star} className="relative">
              <Star size={size} className="text-sand-300" />
              {(filled || half) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: half ? "50%" : "100%" }}
                >
                  <Star size={size} className="fill-wheat-400 text-wheat-400" />
                </span>
              )}
            </span>
          );
        })}
      </div>

      <span className="text-sm font-semibold text-sand-700">{rating.toFixed(1)}</span>

      {count !== undefined && (
        <span className="text-xs text-sand-500">({count})</span>
      )}

      <span className="sr-only">Rated {rating} out of 5</span>
    </div>
  );
}
