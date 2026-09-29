import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

import { Whatsapp } from "../components/BrandIcons";
import { sendEnquiry } from "../api/enquiryApi";
import CTASection from "../components/CTASection";
import business from "../config/business";

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

const SUBJECTS = [
  "General enquiry",
  "Product availability",
  "Bulk / wholesale pricing",
  "Delivery & timing",
  "Something else",
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  subject: SUBJECTS[0],
  message: "",
  // Honeypot — real people never see this, so it must stay empty.
  website: "",
};

export default function Contact() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  const set = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.message.trim().length < 10) {
      setError("Please add a little more detail so we can help properly.");
      return;
    }

    setStatus("sending");
    setError("");

    try {
      await sendEnquiry(form);
      setStatus("sent");
      setForm(emptyForm);
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  const fullAddress = [
    business.address.line1,
    business.address.line2,
    business.address.city,
    business.address.state,
    business.address.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-sand-50 to-wheat-50 py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-50" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Get in touch
            </p>

            <h1 className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Talk to {business.name}
            </h1>

            <p className="mt-4 text-sand-600">
              Questions about a product, bulk pricing or delivery? Send a message
              and we'll reply — usually the same day.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-8 lg:grid-cols-[400px_1fr]">
            {/* Contact details */}
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-8 text-white shadow-2xl">
                <div
                  className="animate-float-slow pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl"
                  aria-hidden="true"
                />

                <div className="relative">
                  <h2 className="font-display text-2xl font-bold">
                    Come and see us
                  </h2>

                  <p className="mt-3 leading-relaxed text-brand-100">
                    We're happy to talk through what you're planning for the season.
                  </p>

                  <ul className="mt-8 space-y-6">
                    {business.phone && (
                      <li className="flex gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-wheat-300 backdrop-blur">
                          <Phone size={19} />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                            Phone
                          </p>
                          <a
                            href={`tel:${business.phone.replace(/\s/g, "")}`}
                            className="mt-0.5 block font-semibold transition hover:text-wheat-300"
                          >
                            {business.phone}
                          </a>
                        </div>
                      </li>
                    )}

                    {business.email && (
                      <li className="flex gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-wheat-300 backdrop-blur">
                          <Mail size={19} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                            Email
                          </p>
                          <a
                            href={`mailto:${business.email}`}
                            className="mt-0.5 block break-all font-semibold transition hover:text-wheat-300"
                          >
                            {business.email}
                          </a>
                        </div>
                      </li>
                    )}

                    {fullAddress && (
                      <li className="flex gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-wheat-300 backdrop-blur">
                          <MapPin size={19} />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                            Address
                          </p>
                          <p className="mt-0.5 leading-relaxed text-brand-100">
                            {fullAddress}
                          </p>
                        </div>
                      </li>
                    )}

                    {business.hours?.map((slot) => (
                      <li key={slot.days} className="flex gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-wheat-300 backdrop-blur">
                          <Clock size={19} />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                            {slot.days}
                          </p>
                          <p className="mt-0.5 text-brand-100">{slot.time}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {business.social?.whatsapp && (
                <a
                  href={business.social.whatsapp}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="card card-hover flex items-center gap-4 p-5"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <Whatsapp size={24} />
                  </span>
                  <span>
                    <span className="block font-bold text-sand-900">
                      Message us on WhatsApp
                    </span>
                    <span className="block text-sm text-sand-500">
                      Quickest way to reach us
                    </span>
                  </span>
                </a>
              )}
            </div>

            {/* Form */}
            <div className="card p-7 sm:p-9">
              {status === "sent" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="flex min-h-[420px] flex-col items-center justify-center text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 15 }}
                    className="relative grid h-20 w-20 place-items-center rounded-full bg-brand-100"
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/50" />
                    <CheckCircle2 size={40} className="relative text-brand-700" />
                  </motion.div>

                  <h2 className="mt-7 font-display text-2xl font-bold text-sand-900">
                    Message received
                  </h2>

                  <p className="mt-3 max-w-sm text-sand-600">
                    Thanks for getting in touch. We'll reply to your email or call
                    you — usually within a working day.
                  </p>

                  <button
                    onClick={() => setStatus("idle")}
                    className="btn-shine mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800"
                  >
                    <MessageSquare size={17} />
                    Send another message
                  </button>
                </motion.div>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-bold text-sand-900">
                    Send us a message
                  </h2>
                  <p className="mt-1.5 text-sm text-sand-500">
                    Fields marked with * are required.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="name"
                          className="text-sm font-semibold text-sand-700"
                        >
                          Your name *
                        </label>
                        <input
                          id="name"
                          required
                          value={form.name}
                          onChange={set("name")}
                          placeholder="Full name"
                          className={`mt-1.5 ${field}`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="phone"
                          className="text-sm font-semibold text-sand-700"
                        >
                          Phone number
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={form.phone}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                            }))
                          }
                          placeholder="10-digit mobile"
                          className={`mt-1.5 ${field}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="text-sm font-semibold text-sand-700"
                      >
                        Email address *
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={set("email")}
                        placeholder="you@example.com"
                        className={`mt-1.5 ${field}`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="subject"
                        className="text-sm font-semibold text-sand-700"
                      >
                        What is this about?
                      </label>
                      <select
                        id="subject"
                        value={form.subject}
                        onChange={set("subject")}
                        className={`mt-1.5 ${field}`}
                      >
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="message"
                        className="text-sm font-semibold text-sand-700"
                      >
                        Message *
                      </label>
                      <textarea
                        id="message"
                        required
                        rows={6}
                        value={form.message}
                        onChange={set("message")}
                        placeholder="Tell us what you need — the crop, the area, roughly when you need it by."
                        className={`mt-1.5 resize-none ${field}`}
                      />
                    </div>

                    {/* Honeypot: hidden from users, catches naive bots */}
                    <div className="absolute left-[-9999px]" aria-hidden="true">
                      <label htmlFor="website">Website</label>
                      <input
                        id="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website}
                        onChange={set("website")}
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

                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="btn-shine flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {status === "sending" ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Send message
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
