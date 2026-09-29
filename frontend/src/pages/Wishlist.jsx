import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingCart, Trash2, ArrowRight } from "lucide-react";

import ProductImage from "../components/ui/ProductImage";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import useCartStore from "../store/cartStore";

export default function Wishlist() {
  const toast = useToast();

  const wishlist = useCartStore((s) => s.wishlist);
  const items = useCartStore((s) => s.items);
  const toggleWishlist = useCartStore((s) => s.toggleWishlist);
  const addItem = useCartStore((s) => s.addItem);

  const inCartIds = new Set(items.map((i) => i._id));

  if (wishlist.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          message="Tap the heart on any product to save it here for later — useful while you're comparing options for the season."
          action="/products"
          actionLabel="Browse products"
        />
      </section>
    );
  }

  const moveAllToCart = () => {
    let added = 0;

    wishlist.forEach((product) => {
      if (inCartIds.has(product._id)) return;
      if (product.stock <= 0) return;

      addItem({ ...product, price: product.price }, 1);
      added++;
    });

    if (added > 0) {
      toast.success(`${added} item${added === 1 ? "" : "s"} added to your cart`);
    } else {
      toast.info("Everything is already in your cart");
    }
  };

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Saved for later
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              My wishlist
            </h1>
            <p className="mt-2 text-sand-500">
              {wishlist.length} item{wishlist.length === 1 ? "" : "s"} saved
            </p>
          </div>

          <button
            onClick={moveAllToCart}
            className="btn-shine inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            <ShoppingCart size={16} />
            Move all to cart
          </button>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {wishlist.map((product, i) => {
              const inCart = inCartIds.has(product._id);
              const outOfStock = product.stock <= 0;

              return (
                <motion.div
                  key={product._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="card card-hover flex flex-col overflow-hidden"
                >
                  {/* Image + remove button share a positioned wrapper */}
                  <div className="relative">
                    <Link
                      to={`/products/${product.slug || product._id}`}
                      className="block h-40 overflow-hidden bg-sand-100"
                    >
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        name={product.name}
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-110"
                      />
                    </Link>

                    <button
                      onClick={() => toggleWishlist(product)}
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-sm transition hover:scale-110"
                      aria-label={`Remove ${product.name} from wishlist`}
                    >
                      <Heart size={17} className="fill-clay-500 text-clay-500" />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <Link
                      to={`/products/${product.slug || product._id}`}
                      className="line-clamp-2 font-bold text-sand-900 transition hover:text-brand-700"
                    >
                      {product.name}
                    </Link>

                    <p className="mt-1 text-sm text-sand-500">{product.unit}</p>

                    <div className="mt-auto pt-4">
                      <p className="font-display text-xl font-bold text-sand-900">
                        ₹{Number(product.price).toLocaleString("en-IN")}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            if (outOfStock) {
                              toast.error("This product is out of stock.");
                              return;
                            }
                            if (inCart) {
                              toast.info("Already in your cart");
                              return;
                            }
                            addItem(product, 1);
                            toast.success(`${product.name} added to your cart`);
                          }}
                          disabled={outOfStock || inCart}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
                            outOfStock
                              ? "cursor-not-allowed bg-sand-200 text-sand-500"
                              : inCart
                                ? "bg-brand-50 text-brand-700"
                                : "btn-shine bg-brand-700 text-white hover:bg-brand-800"
                          }`}
                        >
                          <ShoppingCart size={15} />
                          {outOfStock ? "Unavailable" : inCart ? "In cart" : "Add to cart"}
                        </button>

                        <button
                          onClick={() => toggleWishlist(product)}
                          className="rounded-xl border border-sand-200 px-3 text-sand-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${product.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
          >
            Continue shopping <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
