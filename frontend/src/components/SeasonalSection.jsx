import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CloudRain, Snowflake, Sun, ArrowRight } from "lucide-react";

/**
 * Seasonal buying guide.
 *
 * `month` is 0-indexed (0 = January), so the current season is highlighted
 * automatically without anyone having to edit this file each season.
 */
const SEASONS = [
  {
    id: "kharif",
    label: "Kharif",
    months: [5, 6, 7, 8, 9], // June – October
    icon: CloudRain,
    tone: "from-brand-700 to-brand-900",
    accent: "text-brand-300",
    blurb:
      "Sow with the monsoon. Best time for paddy, maize, soybean and groundnut.",
    picks: ["Paddy seeds", "Basal fertiliser", "Insecticides"],
  },
  {
    id: "rabi",
    label: "Rabi",
    months: [10, 11, 0, 1], // November – February
    icon: Snowflake,
    tone: "from-wheat-500 to-wheat-700",
    accent: "text-wheat-200",
    blurb:
      "Winter crops on cooler nights. Ideal for wheat, mustard and gram.",
    picks: ["Wheat seeds", "Mustard seeds", "Fungicides"],
  },
  {
    id: "zaid",
    label: "Zaid",
    months: [2, 3, 4], // March – May
    icon: Sun,
    tone: "from-clay-500 to-clay-700",
    accent: "text-clay-200",
    blurb:
      "The short summer season. Watermelon, muskmelon and summer vegetables.",
    picks: ["Vegetable seeds", "Drip irrigation", "Growth boosters"],
  },
];

const currentMonth = new Date().getMonth();

const isCurrent = (season) => season.months.includes(currentMonth);

export default function SeasonalSection() {
  return (
    <section className="bg-sand-50 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600"
          >
            Plan ahead
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.06 }}
            className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl"
          >
            What to buy, and when
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            className="mt-4 text-sand-600"
          >
            Indian farming runs on three seasons. Here's what's worth stocking for
            each of them.
          </motion.p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {SEASONS.map((season, i) => {
            const Icon = season.icon;
            const active = isCurrent(season);

            return (
              <motion.article
                key={season.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${
                  season.tone
                } p-7 text-white shadow-lift transition-transform duration-500 hover:-translate-y-1.5 ${
                  active ? "ring-4 ring-wheat-300/50" : ""
                }`}
              >
                <div
                  className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-125"
                  aria-hidden="true"
                />

                {active && (
                  <span className="absolute right-5 top-5 rounded-full bg-wheat-300 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-wheat-900">
                    In season now
                  </span>
                )}

                <motion.span
                  whileHover={{ rotate: -10, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 14 }}
                  className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur"
                >
                  <Icon size={28} strokeWidth={1.7} />
                </motion.span>

                <h3 className="relative mt-6 font-display text-2xl font-bold">
                  {season.label}
                </h3>

                <p className={`relative mt-2 text-sm ${season.accent}`}>{season.blurb}</p>

                <ul className="relative mt-6 flex flex-wrap gap-2">
                  {season.picks.map((pick) => (
                    <li
                      key={pick}
                      className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur"
                    >
                      {pick}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/products"
                  className="relative mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-wheat-200"
                >
                  Browse for {season.label}
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
