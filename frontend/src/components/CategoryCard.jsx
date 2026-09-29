import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

/**
 * A shop-by-category tile. Links to the products page with the category
 * pre-filtered, so the visitor lands on real results.
 */
export default function CategoryCard({ category, index = 0 }) {
  const Icon = category.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.07, 0.42),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        to={`/products?category=${encodeURIComponent(category.name)}`}
        className="card card-hover group relative flex h-full flex-col overflow-hidden p-6"
      >
        {/* Wash that sweeps in on hover */}
        <span
          className="absolute inset-0 bg-gradient-to-br from-brand-50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 400, damping: 14 }}
            className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-700 group-hover:text-white"
          >
            <Icon size={26} strokeWidth={1.8} />
          </motion.span>

          <ArrowUpRight
            size={18}
            className="text-sand-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600"
          />
        </div>

        <h3 className="relative mt-5 font-display text-lg font-bold text-sand-900 transition-colors group-hover:text-brand-700">
          {category.name}
        </h3>

        <p className="relative mt-2 line-clamp-2 text-sm leading-relaxed text-sand-500">
          {category.description}
        </p>

        {category.count > 0 && (
          <p className="relative mt-4 text-xs font-semibold text-brand-600">
            {category.count} product{category.count === 1 ? "" : "s"}
          </p>
        )}
      </Link>
    </motion.div>
  );
}
