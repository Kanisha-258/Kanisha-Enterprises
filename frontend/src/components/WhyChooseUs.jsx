import { HandCoins, PackageCheck, UserRoundCheck, Truck, BadgeCheck, Users } from "lucide-react";
import Reveal, { RevealGroup, RevealItem } from "./ui/Reveal";

const REASONS = [
  {
    icon: BadgeCheck,
    title: "Quality we stand behind",
    text: "Every batch is checked before it reaches the shelf, and if something isn't right we'll replace it.",
  },
  {
    icon: HandCoins,
    title: "Honest, fair pricing",
    text: "One clear price for everyone, with seasonal offers you can actually see before you pay.",
  },
  {
    icon: UserRoundCheck,
    title: "Advice from people who farm",
    text: "Not call-centre scripts — practical guidance based on what is actually working in the fields.",
  },
  {
    icon: PackageCheck,
    title: "Genuine stock, always",
    text: "Live availability, so what you see is genuinely on the shelf today.",
  },
  {
    icon: Truck,
    title: "Delivered to your door",
    text: "Local delivery across town, and dispatch for farmers further out.",
  },
  {
    icon: Users,
    title: "Bulk & dealer rates",
    text: "Buying for a whole village? Talk to us about wholesale pricing.",
  },
];

const STATS = [
  { value: "10+", label: "Years serving farmers" },
  { value: "500+", label: "Orders delivered monthly" },
  { value: "26+", label: "Products in store" },
  { value: "4.9", label: "Average rating" },
];

export default function WhyChooseUs() {
  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-24">
      <div
        className="animate-float-slow pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-brand-100/50 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Copy + stats */}
          <div>
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                Why choose us
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-sand-900 sm:text-4xl">
                A shop that works as hard as you do
              </h2>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 text-sand-600">
                We've built our business on one simple idea: a farmer who trusts
                their supplier can take on more risk in the field. So we keep our
                advice honest and our stock real.
              </p>
            </Reveal>

            <RevealGroup
              as="dl"
              className="mt-10 grid grid-cols-2 gap-4"
              stagger={0.08}
            >
              {STATS.map((stat) => (
                <RevealItem
                  key={stat.label}
                  className="rounded-2xl border border-sand-200 bg-sand-50 p-5"
                >
                  <dt className="font-display text-3xl font-bold text-brand-700">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-sm text-sand-500">{stat.label}</dd>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>

          {/* Reasons */}
          <RevealGroup className="grid gap-4 sm:grid-cols-2" stagger={0.09}>
            {REASONS.map(({ icon: Icon, title, text }) => (
              <RevealItem
                key={title}
                className="card card-hover group p-5"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-700 group-hover:text-white">
                  <Icon size={21} />
                </span>

                <h3 className="mt-4 font-bold text-sand-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-sand-500">{text}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
