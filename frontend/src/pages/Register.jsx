import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Leaf,
  ArrowRight,
  AlertCircle,
  Check,
  MapPin,
} from "lucide-react";

import { register } from "../api/authApi";
import useAuthStore from "../store/authStore";

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const inputCls =
  "w-full rounded-xl border border-sand-200 bg-white py-3 pl-11 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  const set = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setError("");
  };

  // Step 1 only needs the three identity fields to be valid before moving on.
  const step1Valid =
    form.name.trim().length > 1 &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    /^[0-9]{10}$/.test(form.phone) &&
    form.password.length >= 8;

  const goToStep2 = (e) => {
    e.preventDefault();
    if (!step1Valid) {
      setError("Please complete every field. Password must be at least 8 characters.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await register(form);
      setAuth(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
      // A duplicate email means they're not really a "new" user.
      if (err.status === 409) setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-sand-50 to-wheat-50 px-4 py-14">
      <div className="animate-float-slow pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" aria-hidden="true" />
      <div className="animate-float-slow pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-wheat-200/40 blur-3xl" style={{ animationDelay: "-6s" }} aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg"
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-sand-500">
              Order faster and keep track of every delivery.
            </p>
          </div>

          {/* Step indicator */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                1
              </span>
              <span className="text-xs font-semibold text-sand-700">Your details</span>
            </div>

            <span className={`h-0.5 flex-1 transition-colors ${step === 2 ? "bg-brand-600" : "bg-sand-200"}`} />

            <div className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
                  step === 2
                    ? "bg-brand-700 text-white"
                    : "bg-sand-200 text-sand-500"
                }`}
              >
                {step === 2 ? <Check size={14} strokeWidth={3} /> : "2"}
              </span>
              <span
                className={`text-xs font-semibold ${
                  step === 2 ? "text-sand-700" : "text-sand-400"
                }`}
              >
                Delivery address
              </span>
            </div>
          </div>

          <form onSubmit={step === 1 ? goToStep2 : handleSubmit} className="mt-8 space-y-5">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Full name
                    </label>
                    <div className="relative mt-1.5">
                      <UserRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400" />
                      <input
                        required
                        value={form.name}
                        onChange={set("name")}
                        placeholder="Your name"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Email address
                    </label>
                    <div className="relative mt-1.5">
                      <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400" />
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={set("email")}
                        placeholder="you@example.com"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Mobile number
                    </label>
                    <div className="relative mt-1.5">
                      <Phone size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400" />
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                        placeholder="10-digit mobile"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400" />
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        value={form.password}
                        onChange={set("password")}
                        placeholder="At least 8 characters"
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
                    </div>

                    <p className="mt-2 text-xs text-sand-400">
                      Use at least 8 characters. Avoid names and birthdays.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="btn-shine flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800"
                  >
                    Continue <ArrowRight size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <p className="text-sm text-sand-500">
                    This saves your default address so checkout takes seconds next time.
                    You can change it any time.
                  </p>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Address line 1
                    </label>
                    <div className="relative mt-1.5">
                      <MapPin size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sand-400" />
                      <input
                        required
                        value={form.address}
                        onChange={set("address")}
                        placeholder="House / street"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-sand-700">City</label>
                      <input
                        required
                        value={form.city}
                        onChange={set("city")}
                        placeholder="Your city"
                        className="mt-1.5 w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-sand-700">State</label>
                      <select
                        required
                        value={form.state}
                        onChange={set("state")}
                        className="mt-1.5 w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      >
                        <option value="">Select state</option>
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">Pincode</label>
                    <input
                      required
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      placeholder="6-digit pincode"
                      className="mt-1.5 w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
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

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setError("");
                      }}
                      className="rounded-xl border border-sand-200 px-5 py-3.5 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating account…
                        </>
                      ) : (
                        <>
                          Create account <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <p className="mt-7 text-center text-sm text-sand-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-brand-700 transition hover:text-brand-800"
            >
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </section>
  );
}
