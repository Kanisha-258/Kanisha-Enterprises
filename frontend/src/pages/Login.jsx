import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, Leaf, ArrowRight, AlertCircle } from "lucide-react";

import { login } from "../api/authApi";
import useAuthStore from "../store/authStore";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Where to go after signing in: the page they were blocked from, if any.
  const redirectTo =
    searchParams.get("next") || location.state?.from?.pathname || "/dashboard";

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(form);
      setAuth(data.token, data.user);
      navigate(redirectTo, { replace: true });
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
      <div
        className="animate-float-slow pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-wheat-200/40 blur-3xl"
        style={{ animationDelay: "-6s" }}
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
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 14 }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow"
            >
              <Leaf size={27} />
            </motion.span>

            <h1 className="mt-6 font-display text-2xl font-bold text-sand-900 sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-sand-500">
              Log in to track orders and check out faster.
            </p>
          </div>

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
                  name="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-sand-200 bg-white py-3 pl-11 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-semibold text-sand-700">
                Password
              </label>

              <div className="relative mt-1.5">
                <Lock
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Your password"
                  className="w-full rounded-xl border border-sand-200 bg-white py-3 pl-11 pr-11 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sand-400 transition hover:text-sand-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>

                <div className="mt-2 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                  >
                    Forgot your password?
                  </Link>
                </div>
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
                  Logging in…
                </>
              ) : (
                <>
                  Login <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-sand-600">
            New to Kanisha Enterprises?{" "}
            <Link
              to="/register"
              className="font-semibold text-brand-700 transition hover:text-brand-800"
            >
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-sand-400">
          Admin? Sign in with the account created by{" "}
          <code className="rounded bg-sand-200 px-1.5 py-0.5">npm run seed:admin</code>
        </p>
      </motion.div>
    </section>
  );
}
