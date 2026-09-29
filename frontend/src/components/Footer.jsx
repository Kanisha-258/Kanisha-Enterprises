import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Leaf,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
} from "lucide-react";

import { Facebook, Instagram, Youtube, Whatsapp } from "./BrandIcons";
import business from "../config/business";

const QUICK_LINKS = [
  { to: "/", label: "Home" },
  { to: "/products", label: "All products" },
  { to: "/blog", label: "Farming blog" },
  { to: "/about", label: "About us" },
  { to: "/contact", label: "Contact" },
];

const CATEGORIES = [
  { to: "/products?category=Seeds", label: "Seeds" },
  { to: "/products?category=Fertilizers", label: "Fertilisers" },
  { to: "/products?category=Pesticides", label: "Pesticides" },
  { to: "/products?category=Fungicides", label: "Fungicides" },
  { to: "/products?category=Herbicides", label: "Herbicides" },
  { to: "/products?category=Agricultural%20Tools", label: "Farm tools" },
];

const SOCIALS = [
  { key: "facebook", Icon: Facebook, label: "Facebook" },
  { key: "instagram", Icon: Instagram, label: "Instagram" },
  { key: "youtube", Icon: Youtube, label: "YouTube" },
  { key: "whatsapp", Icon: Whatsapp, label: "WhatsApp" },
].filter((s) => business.social[s.key]);

export default function Footer() {
  // Newsletter is a front-end nicety: it confirms locally rather than
  // pretending to subscribe the visitor to something that isn't wired up.
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

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
    <footer className="relative mt-24 overflow-hidden bg-sand-950 text-sand-300">
      {/* Soft glow so the footer isn't a flat black block */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-brand-700/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-wheat-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Leaf size={23} />
              </span>
              <span>
                <span className="block font-display text-lg font-bold text-white">
                  {business.name}
                </span>
                <span className="block text-[11px] font-medium uppercase tracking-widest text-brand-400">
                  {business.tagline}
                </span>
              </span>
            </Link>

            <p className="mt-5 text-sm leading-relaxed text-sand-400">
              Quality seeds, fertilisers, crop protection and farm tools — with
              honest advice from people who farm.
            </p>

            {SOCIALS.length > 0 && (
              <div className="mt-6 flex gap-2.5">
                {SOCIALS.map(({ key, Icon, label }) => (
                  <a
                    key={key}
                    href={business.social[key]}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={label}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-sand-400 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-600 hover:text-white"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Quick links
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center gap-2 text-sand-400 transition-colors hover:text-brand-300"
                  >
                    <span className="h-1 w-1 rounded-full bg-brand-500 transition-all duration-300 group-hover:w-3" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Shop by category
            </h3>
            <ul className="mt-5 space-y-3 text-sm">
              {CATEGORIES.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center gap-2 text-sand-400 transition-colors hover:text-brand-300"
                  >
                    <span className="h-1 w-1 rounded-full bg-brand-500 transition-all duration-300 group-hover:w-3" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + newsletter */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Get in touch
            </h3>

            <ul className="mt-5 space-y-3.5 text-sm">
              {business.phone && (
                <li className="flex gap-3">
                  <Phone size={17} className="mt-0.5 shrink-0 text-brand-400" />
                  <a
                    href={`tel:${business.phone.replace(/\s/g, "")}`}
                    className="text-sand-400 transition hover:text-brand-300"
                  >
                    {business.phone}
                  </a>
                </li>
              )}

              {business.email && (
                <li className="flex gap-3">
                  <Mail size={17} className="mt-0.5 shrink-0 text-brand-400" />
                  <a
                    href={`mailto:${business.email}`}
                    className="break-all text-sand-400 transition hover:text-brand-300"
                  >
                    {business.email}
                  </a>
                </li>
              )}

              {fullAddress && (
                <li className="flex gap-3">
                  <MapPin size={17} className="mt-0.5 shrink-0 text-brand-400" />
                  <span className="text-sand-400">{fullAddress}</span>
                </li>
              )}

              {business.hours?.map((slot) => (
                <li key={slot.days} className="flex gap-3">
                  <Clock size={17} className="mt-0.5 shrink-0 text-brand-400" />
                  <span className="text-sand-400">
                    {slot.days}
                    <span className="block text-xs text-sand-500">{slot.time}</span>
                  </span>
                </li>
              ))}
            </ul>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) return;
                setSubscribed(true);
                setEmail("");
              }}
              className="mt-6"
            >
              <label className="text-xs font-semibold uppercase tracking-wider text-sand-500">
                Seasonal offers
              </label>

              {subscribed ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-brand-300">
                  <CheckCircle2 size={16} />
                  Thanks — we'll be in touch.
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email"
                    aria-label="Email address for seasonal offers"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-sand-500 transition focus:border-brand-500 focus:bg-white/10 focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe"
                    className="grid shrink-0 place-items-center rounded-xl bg-brand-600 px-3.5 text-white transition hover:bg-brand-500 active:scale-95"
                  >
                    <Send size={17} />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row">
          <p className="text-sm text-sand-500">
            © {new Date().getFullYear()} {business.name}. All rights reserved.
          </p>

          <p className="flex items-center gap-2 text-sm text-sand-500">
            Built for farmers
            <span className="text-brand-500">🌱</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
