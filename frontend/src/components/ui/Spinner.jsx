import { Loader2 } from "lucide-react";

export function Spinner({ size = 20, className = "" }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

/** Full-width loading state with an accessible label. */
export function LoadingState({ label = "Loading…", className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-20 text-sand-500 ${className}`}
      role="status"
    >
      <Spinner size={30} className="text-brand-500" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/** Full-width error state with an optional retry. */
export function ErrorState({ message, onRetry, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-20 text-center ${className}`}
      role="alert"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl">
        ⚠️
      </div>

      <div>
        <p className="font-semibold text-sand-800">Something went wrong</p>
        <p className="mt-1 max-w-sm text-sm text-sand-500">{message}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default Spinner;
