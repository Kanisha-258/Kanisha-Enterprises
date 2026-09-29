import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package,
  Heart,
  ShoppingBag,
  MapPin,
  Settings,
  Truck,
  ArrowRight,
  IndianRupee,
  LayoutDashboard,
} from "lucide-react";

import { getMyOrders } from "../api/orderApi";
import useAuthStore, { selectIsAdmin } from "../store/authStore";
import useCartStore, { selectCartCount } from "../store/cartStore";
import { OrderStatusBadge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";

const QUICK_LINKS = [
  {
    to: "/orders",
    icon: Package,
    label: "My orders",
    text: "Track and review past orders",
  },
  {
    to: "/wishlist",
    icon: Heart,
    label: "Wishlist",
    text: "Products you've saved",
  },
  {
    to: "/profile",
    icon: MapPin,
    label: "Addresses",
    text: "Manage delivery addresses",
  },
  {
    to: "/profile",
    icon: Settings,
    label: "Settings",
    text: "Update your details",
  },
];

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore(selectIsAdmin);
  const cartCount = useCartStore(selectCartCount);
  const wishlistCount = useCartStore((s) => s.wishlist.length);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getMyOrders({ limit: 5 })
      .then((data) => {
        if (!cancelled) setOrders(data.orders || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.orderStatus)
  );
  const deliveredOrders = orders.filter((o) => o.orderStatus === "delivered");
  const totalSpent = orders
    .filter((o) => o.orderStatus !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      label: "Total orders",
      value: orders.length,
      icon: ShoppingBag,
      tone: "bg-brand-50 text-brand-700",
    },
    {
      label: "In progress",
      value: activeOrders.length,
      icon: Truck,
      tone: "bg-wheat-50 text-wheat-700",
    },
    {
      label: "Delivered",
      value: deliveredOrders.length,
      icon: Package,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Total spent",
      value: `₹${totalSpent.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      tone: "bg-clay-50 text-clay-700",
    },
  ];

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Your dashboard
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Welcome back, {firstName} 👋
            </h1>
            <p className="mt-2 text-sand-500">
              Here's everything that's happening with your orders.
            </p>
          </div>

          {isAdmin && (
            <Link
              to="/admin"
              className="btn-shine inline-flex items-center gap-2 rounded-xl bg-clay-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-clay-700"
            >
              <LayoutDashboard size={17} />
              Open admin panel
            </Link>
          )}
        </motion.div>

        {/* Stats */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 + i * 0.07 }}
              className="card card-hover p-5"
            >
              <span
                className={`grid h-11 w-11 place-items-center rounded-xl ${stat.tone}`}
              >
                <stat.icon size={21} />
              </span>

              <p className="mt-4 font-display text-2xl font-bold text-sand-900">
                {stat.value}
              </p>
              <p className="mt-0.5 text-sm text-sand-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Recent orders */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-sand-900">
                Recent orders
              </h2>
              <Link
                to="/orders"
                className="text-sm font-semibold text-brand-700 transition hover:text-brand-800"
              >
                View all
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-14">
                <Spinner size={26} className="text-brand-500" />
              </div>
            ) : orders.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sand-500">You haven't placed any orders yet.</p>
                <Link
                  to="/products"
                  className="btn-shine mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  Browse products <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-sand-100">
                {orders.map((order) => (
                  <li key={order._id}>
                    <Link
                      to={`/orders/${order._id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-sand-50"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sand-900">{order.orderNumber}</p>
                        <p className="mt-0.5 text-sm text-sand-500">
                          {order.items.length} item
                          {order.items.length === 1 ? "" : "s"} ·{" "}
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-bold text-sand-900">
                          ₹{order.total.toLocaleString("en-IN")}
                        </span>
                        <OrderStatusBadge status={order.orderStatus} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cart + wishlist summary */}
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold text-sand-900">
                At a glance
              </h2>

              <div className="mt-4 space-y-3">
                <Link
                  to="/cart"
                  className="flex items-center gap-3 rounded-xl bg-sand-50 p-3.5 transition hover:bg-brand-50"
                >
                  <ShoppingBag size={19} className="shrink-0 text-brand-600" />
                  <span className="flex-1 text-sm font-semibold text-sand-800">
                    Items in cart
                  </span>
                  <span className="font-bold text-sand-900">{cartCount}</span>
                </Link>

                <Link
                  to="/wishlist"
                  className="flex items-center gap-3 rounded-xl bg-sand-50 p-3.5 transition hover:bg-brand-50"
                >
                  <Heart size={19} className="shrink-0 text-clay-500" />
                  <span className="flex-1 text-sm font-semibold text-sand-800">
                    Wishlist
                  </span>
                  <span className="font-bold text-sand-900">{wishlistCount}</span>
                </Link>
              </div>

              {cartCount > 0 && (
                <Link
                  to="/checkout"
                  className="btn-shine mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  Checkout now <ArrowRight size={16} />
                </Link>
              )}
            </div>

            {/* Quick links */}
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold text-sand-900">
                Quick links
              </h2>

              <ul className="mt-4 space-y-1">
                {QUICK_LINKS.map(({ to, icon: Icon, label, text }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-sand-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sand-100 text-sand-500 transition group-hover:bg-brand-700 group-hover:text-white">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-sand-900">
                          {label}
                        </span>
                        <span className="block truncate text-xs text-sand-500">
                          {text}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
