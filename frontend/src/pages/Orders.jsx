import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, ChevronRight } from "lucide-react";

import { getMyOrders } from "../api/orderApi";
import ProductImage from "../components/ui/ProductImage";
import EmptyState from "../components/ui/EmptyState";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/ui/Badge";
import { OrderRowSkeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/Spinner";

// One entry per order status, so no order is invisible from every filter.
// "packed" was missing here, which meant a customer whose order was ready to
// dispatch could only find it under "All".
const TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Orders() {
  // Total units across the order, so "1 item" is not shown for an order of
  // five bags of one product.
  const unitCount = (order) =>
    (order?.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);

  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getMyOrders({
          status: status === "all" ? undefined : status,
          limit: 30,
        });

        if (!cancelled) setOrders(data.orders || []);
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
  }, [status]);

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Your account
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
            My orders
          </h1>
          <p className="mt-2 text-sand-500">
            Track deliveries, review past orders and reorder what you liked.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                status === tab.value
                  ? "bg-brand-700 text-white shadow-glow"
                  : "bg-white text-sand-600 ring-1 ring-sand-200 hover:bg-sand-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          {loading && (
            <>
              <OrderRowSkeleton />
              <OrderRowSkeleton />
              <OrderRowSkeleton />
            </>
          )}

          {!loading && error && <ErrorState message={error} />}

          {!loading && !error && orders.length === 0 && (
            <EmptyState
              icon={Package}
              title={status === "all" ? "No orders yet" : `No ${status} orders`}
              message={
                status === "all"
                  ? "When you place an order it will appear here, along with its delivery status."
                  : "Try a different filter to see your other orders."
              }
              action={status === "all" ? "/products" : undefined}
              actionLabel={status === "all" ? "Start shopping" : undefined}
            />
          )}

          {!loading &&
            !error &&
            orders.map((order, i) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.3) }}
              >
                <Link
                  to={`/orders/${order._id}`}
                  className="card card-hover group block p-5 sm:p-6"
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-sand-400">
                        Order
                      </p>
                      <p className="mt-0.5 font-bold text-sand-900">
                        {order.orderNumber}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={order.orderStatus} />
                      <ChevronRight
                        size={18}
                        className="text-sand-300 transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex -space-x-3">
                      {order.items.slice(0, 4).map((item) => (
                        <div
                          key={item.product}
                          className="h-12 w-12 overflow-hidden rounded-xl border-2 border-white bg-sand-100"
                        >
                          <ProductImage
                            src={item.image}
                            alt=""
                            name={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}

                      {order.items.length > 4 && (
                        <div className="grid h-12 w-12 place-items-center rounded-xl border-2 border-white bg-sand-200 text-xs font-bold text-sand-600">
                          +{order.items.length - 4}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-sand-500">
                        {order.items.map((i) => i.name).join(", ")}
                      </p>
                      {/* Units, not lines: `items.length` counts distinct
                          products, so an order for 5kg of one seed would
                          otherwise read "1 item". */}
                      <p className="mt-0.5 text-xs text-sand-400">
                        {unitCount(order)}{" "}
                        {unitCount(order) === 1 ? "item" : "items"}
                        {order.items.length > 1 && " · "}
                        {order.items.length > 1 && `${order.items.length} products`}
                      </p>
                    </div>
                  </div>

                  {/* Footer row */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sand-100 pt-4 text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-sand-500">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </div>

                    <span className="font-display text-lg font-bold text-sand-900">
                      ₹{order.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
}
