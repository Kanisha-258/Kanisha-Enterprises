import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  IndianRupee,
  ShoppingCart,
  Package,
  Users,
  MessageSquare,
  Star,
  TriangleAlert,
  Loader2,
  ArrowRight,
} from "lucide-react";

import { getStats } from "../../api/adminApi";
import StatCard from "./StatCard";
import { OrderStatusBadge } from "../../components/ui/Badge";
import ProductImage from "../../components/ui/ProductImage";

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setData(await getStats());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={30} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold text-sand-800">Could not load the dashboard</p>
        <p className="mt-1 text-sm text-sand-500">{error}</p>
        <button
          onClick={load}
          className="mt-5 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          Try again
        </button>
      </div>
    );
  }

  const { stats, statusCounts, recentOrders, topProducts } = data;

  const cards = [
    {
      label: "Total revenue",
      value: rupees(stats.totalRevenue),
      icon: IndianRupee,
      tone: "bg-brand-50 text-brand-700",
      trend: stats.revenueTrend,
      hint: "All non-cancelled orders",
    },
    {
      label: "Orders this month",
      value: stats.totalOrders,
      icon: ShoppingCart,
      tone: "bg-sky-50 text-sky-700",
      hint: `${stats.pendingOrders} awaiting action`,
    },
    {
      label: "Customers",
      value: stats.totalCustomers,
      icon: Users,
      tone: "bg-wheat-50 text-wheat-700",
      hint: "Registered accounts",
    },
    {
      label: "Products",
      value: stats.totalProducts,
      icon: Package,
      tone: "bg-clay-50 text-clay-700",
      hint: "Active in the catalogue",
    },
  ];

  const alerts = [
    stats.newEnquiries > 0 && {
      icon: MessageSquare,
      label: `${stats.newEnquiries} new ${stats.newEnquiries === 1 ? "enquiry" : "enquiries"}`,
      text: "Waiting for a reply",
      to: "/admin/enquiries",
      tone: "bg-sky-50 text-sky-700",
    },
    stats.pendingOrders > 0 && {
      icon: ShoppingCart,
      label: `${stats.pendingOrders} pending ${stats.pendingOrders === 1 ? "order" : "orders"}`,
      text: "Need confirming",
      to: "/admin/orders?status=pending",
      tone: "bg-wheat-50 text-wheat-700",
    },
    stats.lowStockProducts > 0 && {
      icon: TriangleAlert,
      label: `${stats.lowStockProducts} low on stock`,
      text: "5 or fewer units left",
      to: "/admin/products",
      tone: "bg-red-50 text-red-700",
    },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">
          Shop overview
        </h1>
        <p className="mt-1 text-sm text-sand-500">
          How the business is doing right now.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {alerts.map((alert, i) => (
            <motion.div
              key={alert.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
            >
              <Link
                to={alert.to}
                className="card card-hover flex items-center gap-3.5 p-4"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${alert.tone}`}>
                  <alert.icon size={20} />
                </span>

                <span className="min-w-0">
                  <span className="block text-sm font-bold text-sand-900">
                    {alert.label}
                  </span>
                  <span className="block text-xs text-sand-500">{alert.text}</span>
                </span>

                <ArrowRight size={16} className="ml-auto shrink-0 text-sand-300" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Recent orders */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-sand-900">
              Recent orders
            </h2>
            <Link
              to="/admin/orders"
              className="text-sm font-semibold text-brand-700 transition hover:text-brand-800"
            >
              View all
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-sand-500">
              No orders yet. They'll appear here as customers place them.
            </div>
          ) : (
            <ul className="divide-y divide-sand-100">
              {recentOrders.map((order) => (
                <li key={order._id}>
                  <Link
                    to="/admin/orders"
                    className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-sand-50"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sand-900">{order.orderNumber}</p>
                      <p className="mt-0.5 truncate text-sm text-sand-500">
                        {order.user?.name || order.shippingAddress?.fullName} ·{" "}
                        {order.items.length} item{order.items.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-bold text-sand-900">
                        {rupees(order.total)}
                      </span>
                      <OrderStatusBadge status={order.orderStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {/* Order status breakdown */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-sand-900">
              Order status
            </h2>

            <ul className="mt-4 space-y-2.5">
              {Object.entries(statusCounts || {}).length === 0 ? (
                <li className="text-sm text-sand-500">No orders yet.</li>
              ) : (
                Object.entries(statusCounts).map(([status, count]) => {
                  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
                  const percent = total ? Math.round((count / total) * 100) : 0;

                  return (
                    <li key={status}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <OrderStatusBadge status={status} />
                        </span>
                        <span className="font-semibold text-sand-700">{count}</span>
                      </div>

                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-200">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-brand-500"
                        />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Top products */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-sand-900">
              Best sellers
            </h2>

            {topProducts.length === 0 ? (
              <p className="mt-4 text-sm text-sand-500">
                No sales data yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {topProducts.map((product) => (
                  <li key={product._id} className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                      <ProductImage
                        src={product.image}
                        alt=""
                        name={product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-sand-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-sand-500">
                        {product.units} unit{product.units === 1 ? "" : "s"} sold
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-bold text-sand-900">
                      {rupees(product.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Reviews */}
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-wheat-50 text-wheat-700">
                <Star size={20} />
              </span>
              <div>
                <p className="font-display text-2xl font-bold text-sand-900">
                  {stats.totalReviews}
                </p>
                <p className="text-sm text-sand-500">Customer reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
