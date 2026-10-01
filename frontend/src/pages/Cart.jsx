import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, ShoppingBag, ArrowRight, ShoppingCart, Truck, AlertCircle, Loader2 } from "lucide-react";

import ProductImage from "../components/ui/ProductImage";
import QuantityStepper from "../components/ui/QuantityStepper";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { getCouponConfig } from "../api/couponApi";
import useCartStore, { selectCartCount, selectCartSubtotal } from "../store/cartStore";

/**
 * Says whether the basket is safely stored on the account.
 *
 * Silent by design in the happy case — this is a reassurance, not a feature.
 * The one thing it must never do is claim success when the save failed, so an
 * error is stated plainly. The cart itself is still correct locally either way;
 * this only concerns the copy that follows the customer to another device.
 */
function CartSyncNote({ status }) {
  if (status === "error") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-wheat-700">
        <AlertCircle size={13} />
        Saved on this device only — we couldn&rsquo;t reach the server to save
        your cart. Your order will still work.
      </p>
    );
  }

  if (status === "syncing") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-sand-400">
        <Loader2 size={13} className="animate-spin" />
        Saving your cart…
      </p>
    );
  }

  return null;
}

export default function Cart() {
  const navigate = useNavigate();
  const toast = useToast();

  const items = useCartStore((s) => s.items);
  const count = useCartStore(selectCartCount);
  const subtotal = useCartStore(selectCartSubtotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const syncStatus = useCartStore((s) => s.syncStatus);

  // Delivery thresholds come from the backend so this page can't disagree
  // with what checkout actually charges.
  const [shippingConfig, setShippingConfig] = useState({
    shippingCharge: 0,
    freeShippingAbove: 0,
  });

  useEffect(() => {
    let cancelled = false;

    getCouponConfig()
      .then((config) => {
        if (!cancelled) setShippingConfig(config);
      })
      .catch(() => {
        // Leave at zero rather than guessing; checkout recalculates anyway.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const shipping =
    subtotal === 0 || shippingConfig.shippingCharge === 0
      ? 0
      : subtotal >= shippingConfig.freeShippingAbove
        ? 0
        : shippingConfig.shippingCharge;

  // How much more to spend to reach free delivery (0 if already there).
  const freeDeliveryGap = Math.max(0, shippingConfig.freeShippingAbove - subtotal);

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Once you add something it will show up here, along with delivery options and your total."
          action="/products"
          actionLabel="Start shopping"
        />
      </section>
    );
  }

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Step 1 of 3
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Your cart
            </h1>
            <p className="mt-2 text-sand-500">
              {count} item{count === 1 ? "" : "s"} ready to order
            </p>
            <CartSyncNote status={syncStatus} />
          </div>

          <button
            onClick={() => {
              clearCart();
              toast.info("Cart cleared");
            }}
            className="text-sm font-semibold text-sand-500 transition hover:text-red-600"
          >
            Clear cart
          </button>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Items */}
          <ul className="space-y-4">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.28 }}
                  className="card p-4 sm:p-5"
                >
                  <div className="flex gap-4">
                    <Link
                      to={`/products/${item.slug || item._id}`}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-sand-100 sm:h-28 sm:w-28"
                    >
                      <ProductImage
                        src={item.image}
                        alt={item.name}
                        name={item.name}
                        className="h-full w-full object-cover"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                            {item.category}
                          </p>

                          <Link
                            to={`/products/${item.slug || item._id}`}
                            className="mt-1 line-clamp-2 font-bold text-sand-900 transition hover:text-brand-700"
                          >
                            {item.name}
                          </Link>

                          <p className="mt-1 text-sm text-sand-500">{item.unit}</p>
                        </div>

                        <button
                          onClick={() => {
                            removeItem(item._id);
                            toast.info(`${item.name} removed`);
                          }}
                          className="shrink-0 rounded-xl p-2 text-sand-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                        <QuantityStepper
                          size="sm"
                          value={item.quantity}
                          max={item.stock || 99}
                          onChange={(q) => updateQuantity(item._id, q)}
                        />

                        <div className="text-right">
                          {/* Keyed on quantity, so the line total settles
                              visibly when the stepper is used instead of
                              silently changing. */}
                          <motion.p
                            key={`${item._id}-${item.quantity}`}
                            initial={{ opacity: 0.5, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="font-display text-xl font-bold text-sand-900"
                          >
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </motion.p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-sand-400">
                              ₹{item.price.toLocaleString("en-IN")} each
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>

            <li>
              <Link
                to="/products"
                className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-sand-300 py-4 text-sm font-semibold text-sand-600 transition hover:border-brand-400 hover:text-brand-700"
              >
                <ShoppingCart size={16} />
                Add more products
              </Link>
            </li>
          </ul>

          {/* Summary */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold text-sand-900">
                Order summary
              </h2>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-sand-600">Subtotal</dt>
                  <dd className="font-semibold text-sand-900">
                    ₹{subtotal.toLocaleString("en-IN")}
                  </dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-sand-600">Delivery</dt>
                  <dd className="font-semibold text-sand-900">
                    {shipping === 0 ? (
                      <span className="text-brand-700">Free</span>
                    ) : (
                      `₹${shipping}`
                    )}
                  </dd>
                </div>
              </dl>

              {freeDeliveryGap > 0 && (
                <div className="mt-5 rounded-xl bg-wheat-50 p-3.5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-wheat-800">
                    <Truck size={15} />
                    Add ₹{freeDeliveryGap.toLocaleString("en-IN")} more for free delivery
                  </p>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wheat-200">
                    <motion.div
                      className="h-full rounded-full bg-wheat-500"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, (subtotal / Math.max(1, shippingConfig.freeShippingAbove)) * 100)}%`,
                      }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-baseline justify-between border-t border-sand-200 pt-5">
                <span className="font-semibold text-sand-700">Total</span>
                <span className="font-display text-2xl font-bold text-sand-900">
                  ₹{(subtotal + shipping).toLocaleString("en-IN")}
                </span>
              </div>

              <p className="mt-1 text-xs text-sand-500">
                Discount codes are applied at checkout.
              </p>

              <button
                onClick={() => navigate("/checkout")}
                className="btn-shine mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow"
              >
                Proceed to checkout <ArrowRight size={18} />
              </button>

              <button
                onClick={() => navigate("/products")}
                className="mt-2.5 w-full rounded-xl py-2.5 text-sm font-semibold text-sand-600 transition hover:bg-sand-100"
              >
                Continue shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
