import { useId, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

/**
 * The one text field used by every form on the site.
 *
 * ## Why this exists
 *
 * The forms used to hand-roll this markup, and did it slightly differently
 * each time. The visible symptom on the Login page was an icon that sat at the
 * wrong height.
 *
 * The cause was structural, not cosmetic. The icon was positioned with
 * `absolute top-1/2 -translate-y-1/2`, which centres it against the *wrapper's*
 * height — not the input's. On the password field the wrapper also held the
 * "Forgot your password?" link, so the wrapper was taller than the input and
 * the padlock was pushed down by half the link's height. Any future sibling
 * dropped inside that wrapper would silently move the icon again.
 *
 * The fix is to stop positioning the icon by percentage. Here the icon is a
 * flex sibling of the input, so it centres against the input's own line box
 * and cannot be moved by anything else in the field. No pixel offsets, and the
 * eye button and the "show password" label behave identically in every form.
 */
export default function Field({
  label,
  type = "text",
  value,
  onChange,
  name,
  icon: Icon,
  placeholder,
  hint,
  error,
  required = false,
  min,
  max,
  maxLength,
  inputMode,
  autoComplete,
  as = "input",
  trailing,
  footer,
  className = "",
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const isTextarea = as === "textarea";

  // A password field gets the built-in reveal toggle. `trailing` is for
  // anything else the field needs on the right (a unit, a small status).
  const hasReveal = isPassword && !trailing;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-sand-700"
        >
          {label}
        </label>
      )}

      {/* Flex, not absolute positioning: the icon lines up with the input no
          matter what else is placed inside this wrapper. */}
      <div className="mt-1.5 flex items-stretch">
        {Icon && (
          <span
            className="pointer-events-none flex w-11 shrink-0 items-center justify-center rounded-l-xl border border-r-0 border-sand-200 bg-sand-100/70 text-sand-400"
            aria-hidden="true"
          >
            <Icon size={17} />
          </span>
        )}

        <div className="relative flex min-w-0 flex-1">
          {isTextarea ? (
            <textarea
              id={id}
              name={name}
              rows={3}
              required={required}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              maxLength={maxLength}
              className={`w-full resize-y rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                Icon ? "rounded-l-none" : ""
              }`}
            />
          ) : (
            <input
              id={id}
              name={name}
              type={isPassword && revealed ? "text" : type}
              required={required}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              min={min}
              max={max}
              maxLength={maxLength}
              inputMode={inputMode}
              autoComplete={autoComplete}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={`w-full min-w-0 rounded-xl border border-sand-200 bg-white py-3 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                Icon ? "rounded-l-none pl-4" : "px-4"
              } ${hasReveal ? "pr-11" : trailing ? "pr-24" : "pr-4"} ${
                error ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""
              }`}
            />
          )}

          {hasReveal && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-sand-400 transition hover:bg-sand-100 hover:text-sand-700"
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              tabIndex={-1}
            >
              {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}

          {trailing && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-sand-500">
              {trailing}
            </span>
          )}
        </div>
      </div>

      {footer}

      {hint && !error && <p className="mt-1.5 text-xs text-sand-400">{hint}</p>}

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600"
        >
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
