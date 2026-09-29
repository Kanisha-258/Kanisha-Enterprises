import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

// AnimatePresence is deliberately not used for the detail drawer. Its exit
// animation completed but the node stayed mounted, leaving a strip that
// swallowed clicks. useSlideOver removes the nodes outright instead.
import useSlideOver from "../../hooks/useSlideOver";
import {
  Search,
  Loader2,
  ChevronDown,
  ShoppingCart,
  MapPin,
  Phone,
  Package,
  X,
} from "lucide-react";

import { getAllOrders, updateOrderStatus } from "../../api/orderApi";
import ProductImage from "../../components/ui/ProductImage";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { OrderStatusBadge, PaymentStatusBadge, ORDER_STATUS } from "../../components/ui/Badge";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const NEXT_STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const detailPanel = useSlideOver(Boolean(selected));
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);

      const data = await getAllOrders({
        page,
        limit: 20,
        status,
        search: search || undefined,
      });

      setOrders(data.orders || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, search]);

  const changeStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);

    try {
      const updated = await updateOrderStatus(orderId, newStatus);

      setOrders((current) =>
        current.map((o) => (o._id === orderId ? { ...o, ...updated } : o))
      );
      setSelected((current) =>
        current && current._id === orderId ? { ...current, ...updated } : current
      );

      toast.success(`Order marked as ${newStatus}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Orders</h1>
        <p className="mt-1 text-sm text-sand-500">
          {total} order{total === 1 ? "" : "s"} found
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:min-w-0 sm:flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search order number, name or phone…"
              aria-label="Search orders"
              className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
                setSearchParams(
                  filter.value === "all" ? {} : { status: filter.value },
                  { replace: true }
                );
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                status === filter.value
                  ? "bg-brand-700 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-brand-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          message="Orders will appear here as customers place them."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <motion.div
              key={order._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-bold text-sand-900">
                    {order.orderNumber}
                  </p>
                  <p className="mt-0.5 text-sm text-sand-500">
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.orderStatus} />
                  <PaymentStatusBadge status={order.paymentStatus} />
                  <span className="font-display text-lg font-bold text-sand-900">
                    ₹{order.total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_220px]">
                {/* Items */}
                <div className="flex flex-wrap items-center gap-2">
                  {order.items.slice(0, 5).map((item) => (
                    <div
                      key={item.product}
                      className="flex items-center gap-2 rounded-lg bg-sand-50 py-1.5 pl-1.5 pr-3"
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-md bg-sand-200">
                        <ProductImage
                          src={item.image}
                          alt=""
                          name={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[130px] truncate text-xs font-semibold text-sand-900">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-sand-500">×{item.quantity}</p>
                      </div>
                    </div>
                  ))}

                  {order.items.length > 5 && (
                    <span className="text-xs font-semibold text-sand-500">
                      +{order.items.length - 5} more
                    </span>
                  )}
                </div>

                {/* Customer */}
                <div className="text-sm">
                  <p className="font-semibold text-sand-900">
                    {order.shippingAddress.fullName}
                  </p>
                  <a
                    href={`tel:${order.shippingAddress.phone}`}
                    className="mt-0.5 flex items-center gap-1.5 text-sand-500 transition hover:text-brand-700"
                  >
                    <Phone size={13} />
                    {order.shippingAddress.phone}
                  </a>
                  <p className="mt-0.5 text-xs leading-relaxed text-sand-400">
                    {[order.shippingAddress.line1, order.shippingAddress.city, order.shippingAddress.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>

              {/* Status control */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-sand-400">
                  Update status
                </span>

                <div className="relative">
                  <select
                    value={order.orderStatus}
                    onChange={(e) => changeStatus(order._id, e.target.value)}
                    disabled={updatingId === order._id}
                    className="appearance-none rounded-xl border border-sand-200 bg-white py-2 pl-3.5 pr-9 text-sm font-semibold transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50"
                  >
                    {NEXT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS[s].label}
                      </option>
                    ))}
                  </select>

                  {updatingId === order._id ? (
                    <Loader2
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-500"
                    />
                  ) : (
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sand-400"
                    />
                  )}
                </div>

                <button
                  onClick={() => setSelected(order)}
                  className="rounded-xl border border-sand-200 px-4 py-2 text-sm font-semibold text-sand-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  View details
                </button>

                {order.notes && (
                  <span className="text-xs italic text-sand-400">
                    Note: {order.notes}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}

      {/* Detail drawer. A plain CSS transition rather than AnimatePresence:
          the exit animation completed but the node stayed mounted, leaving a
          strip that swallowed clicks. See useSlideOver. */}
      {detailPanel.mounted && selected && (
        <>
          <div
            onClick={() => setSelected(null)}
            className={`fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm transition-opacity duration-300 ${
              detailPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            className={`fixed inset-y-0 right-0 z-[96] flex w-full max-w-md flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out ${
              detailPanel.shown ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-sand-900">
                    {selected.orderNumber}
                  </h2>
                  <p className="text-xs text-sand-500">
                    {new Date(selected.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="card p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-sand-900">
                    <MapPin size={16} className="text-brand-600" />
                    Deliver to
                  </h3>
                  <address className="mt-2.5 not-italic text-sm leading-relaxed text-sand-600">
                    <p className="font-semibold text-sand-900">
                      {selected.shippingAddress.fullName}
                    </p>
                    <p>{selected.shippingAddress.line1}</p>
                    {selected.shippingAddress.line2 && <p>{selected.shippingAddress.line2}</p>}
                    <p>
                      {selected.shippingAddress.city}, {selected.shippingAddress.state}{" "}
                      {selected.shippingAddress.pincode}
                    </p>
                    <a
                      href={`tel:${selected.shippingAddress.phone}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-brand-700"
                    >
                      <Phone size={14} />
                      {selected.shippingAddress.phone}
                    </a>
                  </address>
                </div>

                <div className="card p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-sand-900">
                    <Package size={16} className="text-brand-600" />
                    Items
                  </h3>

                  <ul className="mt-3 space-y-3">
                    {selected.items.map((item) => (
                      <li key={item.product} className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                          <ProductImage
                            src={item.image}
                            alt=""
                            name={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-sand-900">
                            {item.name}
                          </p>
                          <p className="text-xs text-sand-500">
                            {item.unit} · {item.quantity} × ₹{item.price}
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-bold text-sand-900">
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-4 space-y-2 border-t border-sand-200 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-sand-600">Subtotal</dt>
                      <dd className="font-semibold">₹{selected.subtotal.toLocaleString("en-IN")}</dd>
                    </div>
                    {selected.discount > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-brand-700">Discount</dt>
                        <dd className="font-semibold text-brand-700">
                          −₹{selected.discount.toLocaleString("en-IN")}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-sand-600">Delivery</dt>
                      <dd className="font-semibold">
                        {selected.shippingCharge === 0 ? "Free" : `₹${selected.shippingCharge}`}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-sand-200 pt-2 text-base">
                      <dt className="font-bold">Total</dt>
                      <dd className="font-display text-lg font-bold">
                        ₹{selected.total.toLocaleString("en-IN")}
                      </dd>
                    </div>
                  </dl>
                </div>

                {selected.notes && (
                  <div className="card p-4">
                    <h3 className="text-sm font-bold text-sand-900">Customer note</h3>
                    <p className="mt-2 text-sm italic text-sand-600">{selected.notes}</p>
                  </div>
                )}

                {selected.cancelledReason && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      Cancelled: {selected.cancelledReason}
                    </p>
                  </div>
                )}
              </div>
          </div>
        </>
      )}
    </div>
  );
}
