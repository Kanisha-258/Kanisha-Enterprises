import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Search, Leaf, ArrowRight } from "lucide-react";

const SUGGESTIONS = [
  { to: "/products", label: "Browse all products" },
  { to: "/blog", label: "Read the farming blog" },
  { to: "/contact", label: "Contact us" },
];

export default function NotFound() {
  return (
    <section className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-sand-50 to-wheat-50 px-4 py-20">
      <div className="animate-float-slow pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" aria-hidden="true" />
      <div className="animate-float-slow pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-wheat-200/40 blur-3xl" style={{ animationDelay: "-7s" }} aria-hidden="true" />

      <div className="relative text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow"
        >
          <Leaf size={44} strokeWidth={1.4} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-10 font-display text-7xl font-bold text-gradient sm:text-8xl"
        >
          404
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mt-4 font-display text-2xl font-bold text-sand-900 sm:text-3xl"
        >
          This page has gone to seed
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mx-auto mt-3 max-w-md text-sand-600"
        >
          The page you're looking for doesn't exist, or it may have moved. Let's get
          you back to something useful.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"
        >
          <Link
            to="/"
            className="btn-shine inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-700 px-7 py-3.5 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow"
          >
            <Home size={18} />
            Back to home
          </Link>

          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sand-300 bg-white px-7 py-3.5 font-semibold text-sand-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            <Search size={18} />
            Browse products
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42 }}
          className="mt-10 flex flex-wrap justify-center gap-2"
        >
          {SUGGESTIONS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-sand-600 ring-1 ring-sand-200 transition hover:text-brand-700 hover:ring-brand-300"
            >
              {link.label}
              <ArrowRight
                size={14}
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
