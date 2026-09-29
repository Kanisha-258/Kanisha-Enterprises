import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Package, Truck, Home, Loader2, Phone } from "lucide-react";

import { getOrderById } from "../api/orderApi";
import ProductImage from "../components/ui/ProductImage";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/ui/Badge";
import business from "../config/business";

export default function OrderSuccess() {
  const { orderId } = useParams();
  const location = useLocation();

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);

  // If the user refreshed the page there's no router state, so re-fetch.
  useEffect(() => {
    if (order) return;

    getOrderById(orderId)
      .then((data) => setOrder(data.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [order, orderId]);

  // Computed once on mount rather than during render: reading the clock while
  // rendering is an impure operation and breaks under concurrent rendering.
  const [eta] = useState(() => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-sand-900">
          We couldn't find that order
        </h1>
        <Link
          to="/orders"
          className="mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800"
        >
          View my orders
        </Link>
      </section>
    );
  }

  return (
    <section className="bg-sand-50 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
            className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-100"
          >
            <span className="absolute inset-0 rounded-full bg-brand-200/50 animate-ping" />
            <CheckCircle2 size={40} className="relative text-brand-700" />
          </motion.div>

          <h1 className="mt-7 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
            Thank you — your order is in!
          </h1>

          <p className="mt-3 text-sand-600">
            We've received order{" "}
            <span className="font-bold text-sand-900">{order.orderNumber}</span> and
            will call you to confirm delivery.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <OrderStatusBadge status={order.orderStatus} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {order.paymentMethod === "cod" && (
              <span className="text-sm text-sand-500">Pay on delivery</span>
            )}
          </div>
        </motion.div>

        {/* Delivery estimate */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
          className="card mt-10 p-6"
        >
          <h2 className="font-display text-lg font-bold text-sand-900">
            What happens next
          </h2>

          <ol className="mt-5 space-y-4">
            {[
              {
                icon: Phone,
                title: "We confirm your order",
                text: "Expect a call to confirm the address and delivery timing.",
              },
              {
                icon: Package,
                title: "We pack your items",
                text: "Usually ready within one working day.",
              },
              {
                icon: Truck,
                title: "Delivery",
                text: `Expected around ${eta.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                })}.`,
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="relative flex flex-col items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <step.icon size={19} />
                  </span>
                  {i < 2 && (
                    <span className="mt-1 w-px flex-1 bg-sand-200" aria-hidden="true" />
                  )}
                </span>

                <span className="pb-1">
                  <span className="block font-semibold text-sand-900">
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-sand-500">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Items */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.55 }}
          className="card mt-6 overflow-hidden"
        >
          <div className="border-b border-sand-200 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-sand-900">
              Your items
            </h2>
          </div>

          <ul className="divide-y divide-sand-100">
            {order.items.map((item) => (
              <li key={item.product} className="flex items-center gap-4 px-6 py-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-100">
                  <ProductImage
                    src={item.image}
                    alt=""
                    name={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sand-900">{item.name}</p>
                  <p className="text-sm text-sand-500">
                    {item.unit} · Qty {item.quantity}
                  </p>
                </div>

                <p className="shrink-0 font-bold text-sand-900">
                  ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2.5 border-t border-sand-200 bg-sand-50 px-6 py-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-sand-600">Subtotal</dt>
              <dd className="font-semibold">₹{order.subtotal.toLocaleString("en-IN")}</dd>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-brand-700">Discount</dt>
                <dd className="font-semibold text-brand-700">
                  −₹{order.discount.toLocaleString("en-IN")}
                </dd>
              </div>
            )}

            <div className="flex justify-between">
              <dt className="text-sand-600">Delivery</dt>
              <dd className="font-semibold">
                {order.shippingCharge === 0
                  ? "Free"
                  : `₹${order.shippingCharge}`}
              </dd>
            </div>

            <div className="flex justify-between border-t border-sand-200 pt-3 text-base">
              <dt className="font-bold text-sand-900">Total</dt>
              <dd className="font-display text-xl font-bold text-sand-900">
                ₹{order.total.toLocaleString("en-IN")}
              </dd>
            </div>
          </dl>
        </motion.div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={`/orders/${order._id}`}
            className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800"
          >
            Track this order
          </Link>

          <Link
            to="/products"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white py-3.5 font-semibold text-sand-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            <Home size={17} />
            Continue shopping
          </Link>
        </div>

        {business.phone && (
          <p className="mt-8 text-center text-sm text-sand-500">
            Any questions? Call us on{" "}
            <a
              href={`tel:${business.phone.replace(/\s/g, "")}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {business.phone}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
