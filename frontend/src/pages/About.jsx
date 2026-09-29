import { motion } from "framer-motion";
import {
  Leaf,
  Target,
  Users,
  Sprout,
  ShieldCheck,
  HeartHandshake,
  Award,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";

import Reveal, { RevealGroup, RevealItem } from "../components/ui/Reveal";
import CTASection from "../components/CTASection";
import business from "../config/business";

const VALUES = [
  {
    icon: Leaf,
    title: "Our vision",
    text: "To help farming families do better each season through dependable inputs and practical knowledge.",
  },
  {
    icon: Target,
    title: "Our mission",
    text: "To make quality agricultural products easy to find, easy to afford and easy to order — however remote the farm.",
  },
  {
    icon: Users,
    title: "Who we serve",
    text: "Smallholders, family farms and agri-businesses. If you're growing, you belong here.",
  },
];

const PROMISES = [
  {
    icon: ShieldCheck,
    title: "We only sell what we'd use",
    text: "Every product has been tried or tested. If something doesn't suit your conditions, we'll say so.",
  },
  {
    icon: HeartHandshake,
    title: "Honest advice, always",
    text: "No pressure to buy more than you need. Sometimes the cheapest option really is enough.",
  },
  {
    icon: Sprout,
    title: "Stock that arrives on time",
    text: "We keep the shelves stocked through the season, so you aren't waiting when you need inputs.",
  },
  {
    icon: Award,
    title: "Fair, transparent pricing",
    text: "One clear price for everyone, with seasonal offers listed openly.",
  },
];

const TIMELINE = [
  { year: "2015", title: "A single stall", text: "Kanisha Enterprises started as one counter in the local market, selling paddy and wheat seed to neighbours who trusted us." },
  { year: "2018", title: "Fertilisers and crop care", text: "Demand grew, so we added fertilisers, pesticides and basic tools — becoming a one-stop shop for the season." },
  { year: "2021", title: "Bulk and dealer supply", text: "We began supplying village-level dealers and farmer groups, with proper bulk pricing and delivery." },
  { year: "Today", title: "Serving the region online", text: "Now you can check live stock, place an order and track delivery — with the same people on the counter." },
];

export default function About() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-40" aria-hidden="true" />
        <div className="animate-float-slow pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="animate-float-slow pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-wheat-500/15 blur-3xl" style={{ animationDelay: "-8s" }} aria-hidden="true" />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-bold uppercase tracking-[0.25em] text-wheat-300"
          >
            About us
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6 }}
            className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl"
          >
            Growing with farmers,
            <span className="block text-wheat-300">not just selling to them</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-100"
          >
            {business.name} is a family agricultural business supplying quality
            farming inputs and straightforward advice to growers across the region.
          </motion.p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {VALUES.map((value, i) => (
              <Reveal key={value.title} delay={i * 0.1}>
                <div className="card card-hover group h-full p-8 text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-700 group-hover:text-white">
                    <value.icon size={30} strokeWidth={1.7} />
                  </span>

                  <h2 className="mt-6 font-display text-xl font-bold text-sand-900">
                    {value.title}
                  </h2>

                  <p className="mt-3 leading-relaxed text-sand-600">{value.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Story timeline */}
      <section className="bg-sand-50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                Our story
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
                From one stall to a region
              </h2>
            </Reveal>
          </div>

          <div className="relative mt-14">
            {/* Vertical line */}
            <span
              className="absolute left-[19px] top-2 h-[calc(100%-2rem)] w-0.5 bg-sand-200 md:left-1/2 md:-translate-x-1/2"
              aria-hidden="true"
            />

            <ol className="space-y-10">
              {TIMELINE.map((entry, i) => (
                <li key={entry.year} className="relative">
                  <Reveal delay={0.05}>
                    <div
                      className={`flex gap-6 md:w-1/2 ${
                        i % 2 === 0
                          ? "md:ml-auto md:pl-10"
                          : "md:mr-auto md:flex-row-reverse md:pr-10 md:text-right"
                      }`}
                    >
                      <span
                        className="absolute left-4 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white ring-4 ring-sand-50 md:left-1/2 md:-translate-x-1/2"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>

                      <div className="ml-14 md:ml-0">
                        <span className="inline-block rounded-full bg-wheat-100 px-3 py-1 text-xs font-bold text-wheat-800">
                          {entry.year}
                        </span>
                        <h3 className="mt-3 font-display text-lg font-bold text-sand-900">
                          {entry.title}
                        </h3>
                        <p className="mt-2 leading-relaxed text-sand-600">
                          {entry.text}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                What you can expect
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
                Four things we won't compromise on
              </h2>
            </Reveal>
          </div>

          <RevealGroup className="mt-14 grid gap-6 sm:grid-cols-2" stagger={0.1}>
            {PROMISES.map((promise) => (
              <RevealItem key={promise.title} className="card card-hover flex gap-4 p-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors duration-300">
                  <promise.icon size={24} strokeWidth={1.7} />
                </span>

                <div>
                  <h3 className="font-display text-lg font-bold text-sand-900">
                    {promise.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-sand-600">{promise.text}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Inline CTA */}
      <section className="bg-sand-50 pb-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-lg text-sand-600">
              Have a question about what's right for your land?
            </p>
            <Link
              to="/contact"
              className="btn-shine mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-7 py-4 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow"
            >
              Talk to our team <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
      </section>

      <CTASection />
    </>
  );
}
