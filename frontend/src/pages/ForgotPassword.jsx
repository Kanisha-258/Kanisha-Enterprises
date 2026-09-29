import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Leaf,
  ArrowLeft,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from "lucide-react";

import { forgotPassword } from "../api/authApi";

const field =
  "w-full rounded-xl border border-sand-200 bg-white py-3 pl-11 pr-4 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Only populated by the backend in development, so the flow can be tested
  // before an email provider is connected.
  const [devLink, setDevLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await forgotPassword(email.trim());
      setSent(true);
      setDevLink(data.devResetLink || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-sand-50 to-wheat-50 px-4 py-14">
      <div
        className="animate-float-slow pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl"
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
              {sent ? <CheckCircle2 size={26} /> : <KeyRound size={26} />}
            </span>

            <h1 className="mt-6 font-display text-2xl font-bold text-sand-900 sm:text-3xl">
              {sent ? "Check your inbox" : "Forgot your password?"}
            </h1>

            <p className="mt-2 text-sm text-sand-500">
              {sent
                ? "If an account exists for that email, we've sent a reset link."
                : "Enter your email and we'll send you a link to set a new password."}
            </p>
          </div>

          {sent ? (
            <div className="mt-8 space-y-5">
              {/* Shown only while the backend has no mail provider wired up. */}
              {devLink && (
                <div className="rounded-xl border border-wheat-200 bg-wheat-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-wheat-700">
                    Development only
                  </p>
                  <p className="mt-1.5 text-sm text-wheat-800">
                    No email provider is connected yet, so here is the link
                    directly:
                  </p>
                  <Link
                    to={devLink}
                    className="mt-2 block break-all text-sm font-semibold text-brand-700 underline"
                  >
                    {devLink}
                  </Link>
                </div>
              )}

              <Link
                to="/login"
                className="btn-shine flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800"
              >
                Back to login
              </Link>

              <button
                onClick={() => {
                  setSent(false);
                  setDevLink("");
                }}
                className="w-full text-sm font-semibold text-sand-500 transition hover:text-brand-700"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="text-sm font-semibold text-sand-700">
                  Email address
                </label>

                <div className="relative mt-1.5">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@example.com"
                    className={field}
                  />
                </div>
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
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send reset link
                  </>
                )}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm font-semibold text-sand-600 transition hover:text-brand-700"
              >
                <ArrowLeft size={16} />
                Back to login
              </Link>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-sand-400">
          <Leaf size={13} />
          Reset links expire after one hour.
        </p>
      </motion.div>
    </section>
  );
}
