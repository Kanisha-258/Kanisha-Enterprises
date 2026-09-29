import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Leaf, ShieldCheck, Truck, Sparkles, Star } from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Quality checked" },
  { icon: Truck, label: "Reliable delivery" },
  { icon: Leaf, label: "Farmer-led advice" },
];

/** Staggered entrance for the left-hand copy. */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

export default function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-sand-50 to-wheat-50">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-60" aria-hidden="true" />
      <div
        className="animate-float-slow pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-float-slow pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-wheat-200/40 blur-3xl"
        style={{ animationDelay: "-7s" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
        {/* Copy */}
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-soft backdrop-blur">
              <Sparkles size={14} className="text-wheat-500" />
              Trusted agricultural partner since day one
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-sand-900 sm:text-5xl lg:text-6xl"
          >
            Growing better.
            <span className="mt-1 block text-gradient">Farming smarter.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-lg text-base leading-relaxed text-sand-600 sm:text-lg"
          >
            Quality seeds, fertilisers, crop protection and farm tools — supplied
            with honest advice so every season goes better than the last.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              to="/products"
              className="btn-shine group inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-7 py-4 font-semibold text-white shadow-glow transition-all duration-300 hover:bg-brand-800 hover:shadow-xl"
            >
              Explore products
              <ArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>

            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-brand-700 px-7 py-4 font-semibold text-brand-700 transition-all duration-300 hover:bg-brand-700 hover:text-white"
            >
              Talk to us
            </Link>
          </motion.div>

          <motion.ul
            variants={item}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-sand-600"
          >
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-100 text-brand-700">
                  <Icon size={15} />
                </span>
                {label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-10 shadow-2xl">
            {/* Floating decorative circles */}
            <div
              className="animate-float-slow pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-wheat-400/20 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="animate-float-slow pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-400/25 blur-2xl"
              style={{ animationDelay: "-9s" }}
              aria-hidden="true"
            />

            {/* Rotating dashed ring */}
            {!reduceMotion && (
              <svg
                className="animate-spin-slow pointer-events-none absolute inset-0 h-full w-full opacity-25"
                viewBox="0 0 400 400"
                aria-hidden="true"
              >
                <defs>
                  <path
                    id="hero-ring"
                    d="M200,200 m-150,0 a150,150 0 1,1 300,0 a150,150 0 1,1 -300,0"
                    fill="none"
                  />
                </defs>
                <text className="fill-white/70 text-[11px] font-semibold uppercase tracking-[0.35em]">
                  <textPath href="#hero-ring">
                    Seeds · Fertilizers · Tools · Guidance ·
                  </textPath>
                </text>
              </svg>
            )}

            <div className="relative flex min-h-[380px] flex-col items-center justify-center text-center">
              <motion.div
                animate={reduceMotion ? {} : { y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="grid h-28 w-28 place-items-center rounded-full bg-white/10 text-wheat-200 backdrop-blur"
              >
                <Leaf size={56} strokeWidth={1.1} />
              </motion.div>

              <h2 className="mt-8 font-display text-3xl font-bold text-white sm:text-4xl">
                Better inputs.
              </h2>
              <h2 className="text-3xl font-bold text-wheat-300 sm:text-4xl">
                Better harvests.
              </h2>

              <div className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={13} className="fill-wheat-300 text-wheat-300" />
                ))}
                <span className="ml-1">4.9 average customer rating</span>
              </div>
            </div>
          </div>

          {/* Floating stat card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="absolute -bottom-6 -left-4 hidden rounded-2xl border border-sand-200 bg-white/95 p-4 shadow-lift backdrop-blur sm:block"
          >
            <p className="font-display text-3xl font-bold text-brand-700">10+</p>
            <p className="text-xs font-medium text-sand-500">Years serving farmers</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
