import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Phone, Sparkles } from "lucide-react";

import business from "../config/business";

/** Closing call-to-action band, placed above the footer on most pages. */
export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-sand-50 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 px-8 py-14 text-center shadow-2xl sm:px-14"
        >
          {/* Decorations */}
          <div
            className="animate-float-slow pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="animate-float-slow pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-wheat-500/15 blur-3xl"
            style={{ animationDelay: "-8s" }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-wheat-200 backdrop-blur">
              <Sparkles size={14} />
              We're here to help you grow
            </span>

            <h2 className="mt-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
              Not sure what to plant this season?
            </h2>

            <p className="mt-4 text-base leading-relaxed text-brand-100">
              Tell us your land, your crop and your budget. We'll suggest what
              works — and tell you honestly if you don't need it.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/products"
                className="btn-shine group inline-flex items-center justify-center gap-2 rounded-2xl bg-wheat-300 px-7 py-4 font-semibold text-brand-900 transition-all duration-300 hover:bg-wheat-200 hover:shadow-xl"
              >
                Browse the catalogue
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>

              {business.phone && (
                <a
                  href={`tel:${business.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/25 px-7 py-4 font-semibold text-white transition-all duration-300 hover:border-white hover:bg-white/10"
                >
                  <Phone size={18} />
                  {business.phone}
                </a>
              )}

              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/25 px-7 py-4 font-semibold text-white transition-all duration-300 hover:border-white hover:bg-white/10"
              >
                <MessageCircle size={18} />
                Send an enquiry
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
