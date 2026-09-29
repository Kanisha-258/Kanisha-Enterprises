import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { getProducts } from "../api/productApi";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./ui/Skeleton";
import { ErrorState } from "./ui/Spinner";

/** Homepage strip of the newest products, driven by the real API. */
export default function ProductSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getProducts({ limit: 6, sort: "newest" });

        if (!cancelled) setProducts(data.products || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600"
            >
              Fresh in store
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.06 }}
              className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl"
            >
              Featured products
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="mt-3 max-w-xl text-sand-600"
            >
              Selected for quality and value — the inputs we most often recommend
              to growers.
            </motion.p>
          </div>

          <Link
            to="/products"
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-sand-200 px-5 py-2.5 text-sm font-semibold text-sand-700 transition-all duration-300 hover:border-brand-600 hover:bg-brand-600 hover:text-white sm:self-auto"
          >
            View all
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>

        <div className="mt-12">
          {loading && <ProductGridSkeleton count={6} />}

          {!loading && error && <ErrorState message={error} />}

          {!loading && !error && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product, i) => (
                <ProductCard key={product._id} product={product} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
