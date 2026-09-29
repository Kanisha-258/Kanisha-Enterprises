import { ChevronLeft, ChevronRight } from "lucide-react";

/** Builds a compact page list like 1 … 4 5 6 … 20 */
const pageWindow = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];

  return [1, "…", current - 1, current, current + 1, "…", total];
};

export default function Pagination({ page = 1, totalPages = 1, onChange, className = "" }) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);
  const btn =
    "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-semibold transition";

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}
      aria-label="Pagination"
    >
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} border border-sand-200 bg-white text-sand-600 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40`}
        aria-label="Previous page"
      >
        <ChevronLeft size={17} />
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-sand-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${btn} ${
              p === page
                ? "bg-brand-700 text-white shadow-glow"
                : "border border-sand-200 bg-white text-sand-600 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btn} border border-sand-200 bg-white text-sand-600 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40`}
        aria-label="Next page"
      >
        <ChevronRight size={17} />
      </button>
    </nav>
  );
}
