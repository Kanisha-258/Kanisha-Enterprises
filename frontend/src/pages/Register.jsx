import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound,
  Mail,
  Phone,
  Lock,
  Loader2,
  Leaf,
  ArrowRight,
  AlertCircle,
  Check,
  MapPin,
  Tractor,
  UserRound as UserRoundIcon,
} from "lucide-react";

import { register } from "../api/authApi";
import useAuthStore from "../store/authStore";
import Field from "../components/ui/Field";

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

// What kind of buyer this is. It only labels the account — it grants no extra
// access — so this is a two-button choice rather than a required dropdown.
const ACCOUNT_TYPES = [
  {
    value: "customer",
    label: "I'm buying for myself",
    hint: "Seeds, fertilisers and tools for my own fields",
    Icon: UserRoundIcon,
  },
  {
    value: "dealer",
    label: "I'm a dealer / reseller",
    hint: "Buying in bulk to supply other farmers",
    Icon: Tractor,
  },
];

// Bare inputs (no Field wrapper) share this, so the two steps look identical.
const bareCls =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(1);
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
    userType: "customer",
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
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow"
            >
              <Leaf size={27} />
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.5 }}
              className="mt-6 font-display text-2xl font-bold text-sand-900 sm:text-3xl"
            >
              Create your account
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.5 }}
              className="mt-2 text-sm text-sand-500"
            >
              Order faster and keep track of every delivery.
            </motion.p>
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
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <Field
                    label="Full name"
                    name="name"
                    icon={UserRound}
                    required
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Your name"
                  />

                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    icon={Mail}
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={set("email")}
                    placeholder="you@example.com"
                  />

                  <Field
                    label="Mobile number"
                    name="phone"
                    type="tel"
                    icon={Phone}
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel"
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    placeholder="10-digit mobile"
                  />

                  <Field
                    label="Password"
                    name="password"
                    type="password"
                    icon={Lock}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={form.password}
                    onChange={set("password")}
                    placeholder="At least 8 characters"
                    hint="Use at least 8 characters. Avoid names and birthdays."
                  />

                  {/* Account type. Optional, and defaults to a plain customer,
                      so the sign-up flow is unchanged for anyone who skips it. */}
                  <div>
                    <span className="block text-sm font-semibold text-sand-700">
                      What are you buying for?
                    </span>

                    <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                      {ACCOUNT_TYPES.map(({ value, label, hint, Icon }) => {
                        const selected = form.userType === value;

                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setForm((p) => ({ ...p, userType: value }));
                              setError("");
                            }}
                            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                              selected
                                ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                                : "border-sand-200 bg-white hover:border-sand-300"
                            }`}
                          >
                            <span
                              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                                selected
                                  ? "bg-brand-600 text-white"
                                  : "bg-sand-100 text-sand-500"
                              }`}
                            >
                              <Icon size={16} />
                            </span>

                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-sand-800">
                                {label}
                              </span>
                              <span className="mt-0.5 block text-xs leading-snug text-sand-500">
                                {hint}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="min-h-[3.25rem]" aria-live="polite">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
                        role="alert"
                      >
                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
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

                  <Field
                    label="Address line 1"
                    name="address"
                    icon={MapPin}
                    required
                    value={form.address}
                    onChange={set("address")}
                    placeholder="House / street"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="reg-city"
                        className="block text-sm font-semibold text-sand-700"
                      >
                        City
                      </label>
                      <input
                        id="reg-city"
                        required
                        value={form.city}
                        onChange={set("city")}
                        placeholder="Your city"
                        className={`mt-1.5 ${bareCls}`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-state"
                        className="block text-sm font-semibold text-sand-700"
                      >
                        State
                      </label>
                      <select
                        id="reg-state"
                        required
                        value={form.state}
                        onChange={set("state")}
                        className={`mt-1.5 ${bareCls}`}
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

                  <Field
                    label="Pincode"
                    name="pincode"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={form.pincode}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                      }))
                    }
                    placeholder="6-digit pincode"
                  />

                  <div className="min-h-[3.25rem]" aria-live="polite">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
                        role="alert"
                      >
                        <AlertCircle size={17} className="mt-0.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </div>

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
