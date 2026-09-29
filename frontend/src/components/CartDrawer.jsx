import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, Trash2, X, ArrowRight } from "lucide-react";

import ProductImage from "./ui/ProductImage";
import QuantityStepper from "./ui/QuantityStepper";
import { useToast } from "./ui/Toast";
import useCartStore, { selectCartCount, selectCartSubtotal } from "../store/cartStore";

export default function CartDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();

  const items = useCartStore((s) => s.items);
  const count = useCartStore(selectCartCount);
  const subtotal = useCartStore(selectCartSubtotal);

  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  // Lock the page behind the drawer, and close on Escape.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const goToCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-sand-950/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-sand-900">Your cart</h2>
                  <p className="text-xs text-sand-500">
                    {count === 0
                      ? "Empty"
                      : `${count} item${count === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-xl text-sand-500 transition hover:bg-sand-100 hover:text-sand-800"
                aria-label="Close cart"
              >
                <X size={19} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-400">
                    <ShoppingBag size={28} />
                  </div>
                  <p className="mt-5 font-semibold text-sand-800">Your cart is empty</p>
                  <p className="mt-1 max-w-[15rem] text-sm text-sand-500">
                    Browse our range of seeds, fertilisers and farm tools to get
                    started.
                  </p>

                  <button
                    onClick={() => {
                      onClose();
                      navigate("/products");
                    }}
                    className="btn-shine mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                  >
                    Browse products <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item._id}
                        layout
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex gap-3 rounded-2xl border border-sand-200 p-3"
                      >
                        <Link
                          to={`/products/${item.slug || item._id}`}
                          onClick={onClose}
                          className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-100"
                        >
                          <ProductImage
                            src={item.image}
                            alt={item.name}
                            name={item.name}
                            className="h-full w-full object-cover"
                          />
                        </Link>

                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/products/${item.slug || item._id}`}
                            onClick={onClose}
                            className="line-clamp-2 text-sm font-semibold text-sand-900 transition hover:text-brand-700"
                          >
                            {item.name}
                          </Link>

                          <p className="mt-0.5 text-xs text-sand-500">{item.unit}</p>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <QuantityStepper
                              size="sm"
                              value={item.quantity}
                              max={item.stock || 99}
                              onChange={(q) => updateQuantity(item._id, q)}
                            />

                            <span className="text-sm font-bold text-sand-900">
                              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            removeItem(item._id);
                            toast.info(`${item.name} removed from your cart`);
                          }}
                          className="h-fit shrink-0 rounded-lg p-1.5 text-sand-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="border-t border-sand-200 bg-sand-50 px-5 py-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-sand-600">Subtotal</span>
                  <span className="text-xl font-extrabold text-sand-900">
                    ₹{subtotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <p className="mt-1 text-xs text-sand-500">
                  Shipping and discounts are calculated at checkout.
                </p>

                <button
                  onClick={goToCheckout}
                  className="btn-shine mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow"
                >
                  Proceed to checkout <ArrowRight size={18} />
                </button>

                <button
                  onClick={onClose}
                  className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-sand-600 transition hover:bg-sand-200/60"
                >
                  Continue shopping
                </button>
              </motion.div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
