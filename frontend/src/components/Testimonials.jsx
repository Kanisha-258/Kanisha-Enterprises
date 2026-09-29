import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import Reveal, { RevealGroup, RevealItem } from "./ui/Reveal";

/**
 * Placeholder testimonials.
 *
 * ⚠️ These are examples — replace them with real quotes from actual
 * customers before the site goes live.
 */
const TESTIMONIALS = [
  {
    name: "Ramesh Patil",
    role: "Wheat farmer, 8 acres",
    rating: 5,
    text: "The paddy seeds I bought last Kharif gave a much better yield than the year before. The advice on sowing depth was spot on.",
  },
  {
    name: "Sunita Devi",
    role: "Vegetable grower",
    rating: 5,
    text: "I order tomato and chilli seeds here every season. Quality is consistent and the delivery always comes on time.",
  },
  {
    name: "Arjun Nair",
    role: "Dairy and mixed farming",
    rating: 4,
    text: "They explained the fertiliser difference clearly instead of just selling the expensive one. That honesty is why I keep coming back.",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              From our customers
            </p>
          </Reveal>

          <Reveal delay={0.06}>
            <h2 className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              What growers tell us
            </h2>
          </Reveal>
        </div>

        <RevealGroup
          as="ul"
          className="mt-14 grid gap-6 md:grid-cols-3"
          stagger={0.1}
        >
          {TESTIMONIALS.map((t) => (
            <RevealItem
              as="li"
              key={t.name}
              className="card card-hover relative flex flex-col p-7"
            >
              <Quote
                size={34}
                className="absolute right-6 top-6 text-brand-100"
                aria-hidden="true"
              />

              <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={15}
                    className={
                      i < t.rating
                        ? "fill-wheat-400 text-wheat-400"
                        : "text-sand-200"
                    }
                  />
                ))}
              </div>

              <p className="mt-4 flex-1 text-sm leading-relaxed text-sand-600">
                {t.text}
              </p>

              <div className="mt-6 flex items-center gap-3 border-t border-sand-100 pt-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                  {t.name[0]}
                </span>
                <div>
                  <p className="text-sm font-bold text-sand-900">{t.name}</p>
                  <p className="text-xs text-sand-500">{t.role}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center text-xs text-sand-400"
        >
          Replace these sample quotes with real customer feedback as you collect it.
        </motion.p>
      </div>
    </section>
  );
}
