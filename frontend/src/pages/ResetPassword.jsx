import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Lock,
  Leaf,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Check,
  KeyRound,
  ArrowLeft,
} from "lucide-react";

import { resetPassword, checkResetToken } from "../api/authApi";

const field =
  "w-full rounded-xl border border-sand-200 bg-white py-3 pl-11 pr-4 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("checking"); // checking | ok | invalid
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Check the token up front so an expired link says so, rather than letting
  // the customer fill in a new password that will never work.
  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setStatus("invalid");
      return undefined;
    }

    setStatus("checking");

    checkResetToken(token)
      .then((data) => {
        if (!cancelled) setStatus(data.valid ? "ok" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setStatus("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, password);
      setDone(true);
      // Send them to login rather than auto-login: the JWT is issued by
      // /auth/login, and issuing one here would duplicate that logic.
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err.message);
      if (/invalid or has expired/i.test(err.message)) setStatus("invalid");
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
  })();

  const strengthLabels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const strengthColours = [
    "bg-red-400",
    "bg-red-400",
    "bg-wheat-400",
    "bg-lime-500",
    "bg-brand-500",
  ];

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-sand-50 to-wheat-50 px-4 py-14">
      <div
        className="animate-float-slow pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-wheat-200/40 blur-3xl"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="card p-8 sm:p-10">
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow">
              {done ? <CheckCircle2 size={26} /> : <KeyRound size={26} />}
            </span>

            <h1 className="mt-6 font-display text-2xl font-bold text-sand-900 sm:text-3xl">
              {done
                ? "Password changed"
                : status === "invalid"
                  ? "This link can't be used"
                  : "Set a new password"}
            </h1>

            <p className="mt-2 text-sm text-sand-500">
              {done
                ? "Taking you to the login page…"
                : status === "invalid"
                  ? "Reset links expire after one hour and can only be used once."
                  : "Choose something you don't use anywhere else."}
            </p>
          </div>

          {status === "checking" && (
            <div className="mt-8 flex justify-center">
              <Loader2 size={26} className="animate-spin text-brand-500" />
            </div>
          )}

          {status === "invalid" && (
            <div className="mt-8 space-y-4">
              <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                Request a new link to set your password again.
              </div>

              <Link
                to="/forgot-password"
                className="btn-shine flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800"
              >
                Request a new link
              </Link>
            </div>
          )}

          {status === "ok" && !done && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="password" className="text-sm font-semibold text-sand-700">
                  New password
                </label>

                <div className="relative mt-1.5">
                  <Lock
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="At least 8 characters"
                    className={`${field} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sand-400 transition hover:text-sand-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {/* Strength meter */}
                {password && (
                  <div className="mt-2.5">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i < strength ? strengthColours[strength] : "bg-sand-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-sand-500">
                      {strengthLabels[strength]}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirm" className="text-sm font-semibold text-sand-700">
                  Confirm new password
                </label>

                <div className="relative mt-1.5">
                  <Lock
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400"
                  />
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError("");
                    }}
                    placeholder="Type it again"
                    className={field}
                  />
                </div>

                {confirm && password === confirm && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-700">
                    <Check size={13} />
                    Passwords match
                  </p>
                )}
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
                  role="alert"
                >
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-shine flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    Set new password
                  </>
                )}
              </button>
            </form>
          )}

          {(status === "invalid" || done) && (
            <Link
              to="/login"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-sand-600 transition hover:text-brand-700"
            >
              <ArrowLeft size={16} />
              Back to login
            </Link>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-sand-400">
          <Leaf size={13} />
          You'll be signed out of other devices by changing your password.
        </p>
      </motion.div>
    </section>
  );
}
