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

import { getAllOrders, updateOrderStatus, updatePaymentStatus } from "../../api/orderApi";
import ProductImage from "../../components/ui/ProductImage";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { OrderStatusBadge, PaymentStatusBadge, ORDER_STATUS } from "../../components/ui/Badge";
import { TableSkeleton } from "../../components/ui/Skeleton";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import OrderTimeline from "../../components/OrderTimeline";
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

// "Delivered but unpaid" and "cancelled but refunded" are the two things a shop
// actually opens this list to chase, and neither can be asked with an order
// status filter.
const PAYMENT_FILTERS = [
  { value: "all", label: "Any payment" },
  { value: "pending", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
];

// Mirrors ORDER_FLOW in the backend util, and used only to decide whether a
// change moves an order backwards (which asks for confirmation) or forwards
// (which does not). The list of *legal* targets comes from the API on each
// order, so this never decides what is allowed.
const FORWARD_ORDER = ["pending", "confirmed", "packed", "shipped", "delivered"];

const isBackwardMove = (from, to) =>
  FORWARD_ORDER.indexOf(to) < FORWARD_ORDER.indexOf(from);

/**
 * What the payment control should offer for a given order.
 *
 * Returns an empty list for anything that is not a cash order, because online
 * payments are settled by Razorpay's own signature verification. A "mark paid"
 * button on those would let someone record money that never arrived.
 */
const paymentOptionsFor = (order) => {
  if (order.paymentMethod !== "cod") return [];

  // Refunded is not a door back to "unpaid" — that would contradict the refund
  // and quietly lose an amount of money.
  if (order.paymentStatus === "refunded") return [];

  const options = [];

  // Cash is collected on handover, so this is not offered before then.
  if (
    ["shipped", "delivered"].includes(order.orderStatus) &&
    order.paymentStatus !== "paid"
  ) {
    options.push({ value: "paid", label: "Mark cash collected" });
  }

  if (order.paymentStatus === "paid") {
    options.push({ value: "pending", label: "Mark as not yet collected" });
  }

  return options;
};

export default function AdminOrders() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const detailPanel = useSlideOver(Boolean(selected));
  const [updatingId, setUpdatingId] = useState(null);

  // One confirmation dialog, reused for cancelling, for stepping an order
  // backwards, and for changing payment status. `pendingAction` describes what
  // it is asking about, so only one is ever open.
  const [pendingAction, setPendingAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const data = await getAllOrders({
        page,
        limit: 20,
        status,
        paymentStatus,
        sort,
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
  }, [page, status, paymentStatus, sort, search]);

  /** Put an updated order back into whichever lists currently hold it. */
  const mergeOrder = (updated) =>
    setOrders((current) =>
      current.map((o) => (o._id === updated._id ? { ...o, ...updated } : o))
    );

  const mergeSelected = (updated) =>
    setSelected((current) =>
      current && current._id === updated._id ? { ...current, ...updated } : current
    );

  const changeStatus = async (orderId, newStatus, note = "") => {
    setUpdatingId(orderId);

    try {
      const updated = await updateOrderStatus(orderId, newStatus, note);

      mergeOrder(updated);
      mergeSelected(updated);

      toast.success(
        `Order marked as ${ORDER_STATUS[newStatus]?.label ?? newStatus}`
      );
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const changePayment = async (orderId, newStatus, note = "") => {
    setUpdatingId(orderId);

    try {
      const updated = await updatePaymentStatus(orderId, newStatus, note);

      mergeOrder(updated);
      mergeSelected(updated);

      toast.success("Payment status updated");
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  /**
   * A dropdown choice routes here first.
   *
   * Cancelling and backwards moves open the confirmation dialog — those are the
   * ones with consequences nobody can undo by picking a different option, and
   * cancellation puts stock back into the warehouse. Forward moves are the
   * everyday case and would make a dialog a tax on every order.
   */
  const requestStatusChange = (order, newStatus) => {
    if (newStatus === order.orderStatus) return;

    if (
      newStatus === "cancelled" ||
      isBackwardMove(order.orderStatus, newStatus)
    ) {
      setPendingAction({
        kind: "status",
        orderId: order._id,
        orderNumber: order.orderNumber,
        from: order.orderStatus,
        to: newStatus,
      });
      return;
    }

    changeStatus(order._id, newStatus);
  };

  const requestPaymentChange = (order, value, label) =>
    setPendingAction({
      kind: "payment",
      orderId: order._id,
      orderNumber: order.orderNumber,
      value,
      label,
    });

  const runPendingAction = async (note) => {
    if (!pendingAction) return;

    setActionBusy(true);

    try {
      const ok =
        pendingAction.kind === "status"
          ? await changeStatus(
              pendingAction.orderId,
              pendingAction.to,
              note.trim() ||
                `Moved from ${pendingAction.from} to ${pendingAction.to}`
            )
          : await changePayment(pendingAction.orderId, pendingAction.value, note);

      // Only clear on success. A rejected action stays on screen with whatever
      // was typed, so the reason is not lost and the dialog does not vanish
      // behind an error the admin has not read yet.
      if (ok) setPendingAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  // The drawer's own copy of these, recomputed from the selected order so it
  // reflects a status change made a moment ago in the same view.
  const selectedTransitions = Array.isArray(selected?.availableTransitions)
    ? selected.availableTransitions
    : [];
  const selectedPaymentOptions = selected ? paymentOptionsFor(selected) : [];

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

        {/* Payment filter and sort, on their own row so neither gets squeezed
            out of the layout by a long search box on a narrow screen. */}
        <div className="mt-3 flex flex-col gap-3 border-t border-sand-100 pt-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-sand-400">
              Payment
            </span>

            {PAYMENT_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setPaymentStatus(filter.value);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  paymentStatus === filter.value
                    ? "bg-clay-600 text-white"
                    : "bg-sand-50 text-sand-600 ring-1 ring-inset ring-sand-200 hover:bg-sand-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sand-400">
              Sort
            </span>

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Sort orders by date"
              className="rounded-lg border border-sand-200 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-sand-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
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
          {orders.map((order) => {
            // The API computes this per order from the same rules the update
            // endpoint enforces, so the dropdown and the server agree.
            const transitions = Array.isArray(order.availableTransitions)
              ? order.availableTransitions
              : [];
            const paymentOptions = paymentOptionsFor(order);

            return (
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
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold text-sand-900">
                    {order.shippingAddress.fullName}

                    {/* Dealers place orders in bulk, so knowing which an order
                        came from changes how it should be packed and billed. */}
                    {order.user?.userType === "dealer" && (
                      <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-200">
                        Dealer
                      </span>
                    )}
                  </p>

                  {order.user?.email && (
                    <a
                      href={`mailto:${order.user.email}`}
                      className="mt-0.5 block truncate text-xs text-sand-500 transition hover:text-brand-700"
                    >
                      {order.user.email}
                    </a>
                  )}

                  <a
                    href={`tel:${order.shippingAddress.phone}`}
                    className="mt-0.5 flex items-center gap-1.5 text-xs text-sand-500 transition hover:text-brand-700"
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

                {/* Only the moves the API will actually accept. Offering all six
                    used to mean a dropdown full of options that came back as
                    errors, including ones the shop has no way to act on. */}
                {transitions.length === 0 ? (
                  <span className="text-xs text-sand-500">
                    This order has reached a final state.
                  </span>
                ) : (
                  <div className="relative">
                    <select
                      value={order.orderStatus}
                      onChange={(e) => requestStatusChange(order, e.target.value)}
                      disabled={updatingId === order._id}
                      aria-label={`Change status for order ${order.orderNumber}`}
                      className="appearance-none rounded-xl border border-sand-200 bg-white py-2 pl-3.5 pr-9 text-sm font-semibold transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50"
                    >
                      <option value={order.orderStatus}>
                        {ORDER_STATUS[order.orderStatus]?.label ?? order.orderStatus}
                      </option>

                      {transitions.map((s) => (
                        <option key={s} value={s}>
                          {s === "cancelled"
                            ? "Cancel order…"
                            : `Mark as ${ORDER_STATUS[s]?.label ?? s}`}
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
                )}

                {/* Cash collection. Absent for online payments and for anything
                    where changing it would be wrong, which is why this is a
                    small explicit list rather than a dropdown. */}
                {paymentOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      requestPaymentChange(order, option.value, option.label)
                    }
                    disabled={updatingId === order._id}
                    className="rounded-xl border border-clay-200 bg-white px-3.5 py-2 text-xs font-semibold text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}

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
            );
          })}
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
                {/* Lifecycle, with every recorded step and who made it. */}
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-sand-900">Progress</h3>
                  <div className="mt-4">
                    <OrderTimeline
                      order={selected}
                      showPayment={false}
                      viewer="admin"
                    />
                  </div>

                  {selected.user && (
                    <p className="mt-4 border-t border-sand-200 pt-3 text-xs text-sand-500">
                      Ordered by{" "}
                      <span className="font-semibold text-sand-700">
                        {selected.user.name}
                      </span>
                      {selected.user.userType === "dealer" && " (dealer)"}
                      {selected.user.email && (
                        <>
                          {" · "}
                          <a
                            href={`mailto:${selected.user.email}`}
                            className="transition hover:text-brand-700"
                          >
                            {selected.user.email}
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>

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

                {/* Status and payment controls in the drawer too, so the shop
                    can work from the detail view without going back to the
                    list. They use the same dialogs as the list. */}
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-sand-900">
                    Actions
                  </h3>

                  {selectedTransitions.length === 0 ? (
                    <p className="mt-2 text-xs text-sand-500">
                      This order has reached a final state and cannot be
                      changed.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedTransitions.map((s) => (
                        <button
                          key={s}
                          onClick={() => requestStatusChange(selected, s)}
                          disabled={updatingId === selected._id}
                          className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                            s === "cancelled"
                              ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                              : "border-sand-200 bg-white text-sand-700 hover:border-brand-300 hover:text-brand-700"
                          }`}
                        >
                          {s === "cancelled"
                            ? "Cancel order"
                            : `Mark as ${ORDER_STATUS[s]?.label ?? s}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedPaymentOptions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-sand-100 pt-3">
                      {selectedPaymentOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() =>
                            requestPaymentChange(
                              selected,
                              option.value,
                              option.label
                            )
                          }
                          disabled={updatingId === selected._id}
                          className="rounded-xl border border-clay-200 bg-white px-3.5 py-2 text-xs font-semibold text-clay-700 transition hover:bg-clay-50 disabled:opacity-50"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {selected.paymentMethod === "razorpay" && (
                    <p className="mt-3 text-xs leading-relaxed text-sand-500">
                      Online payment status is set by Razorpay once it confirms
                      the transaction, so it cannot be edited here.
                    </p>
                  )}
                </div>
              </div>
          </div>
        </>
      )}

      {/* One dialog, three jobs. Cancelling always asks for a reason because
          that reason is the record of why stock came back into the warehouse. */}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => !actionBusy && setPendingAction(null)}
        onConfirm={runPendingAction}
        busy={actionBusy}
        showReason
        tone={pendingAction?.kind === "status" && pendingAction?.to === "cancelled" ? "danger" : "default"}
        title={
          pendingAction?.kind === "payment"
            ? pendingAction.label
            : pendingAction?.to === "cancelled"
            ? `Cancel order ${pendingAction.orderNumber}?`
            : `Move order ${pendingAction?.orderNumber} back to ${ORDER_STATUS[pendingAction?.to]?.label ?? ""}?`
        }
        confirmLabel={
          pendingAction?.kind === "payment"
            ? "Yes, update it"
            : pendingAction?.to === "cancelled"
            ? "Yes, cancel the order"
            : "Yes, move it back"
        }
        description={
          pendingAction?.kind === "payment"
            ? "This records what actually happened to the money, and who recorded it."
            : pendingAction?.to === "cancelled"
            ? "The items go back into stock straight away, and any amount already paid is marked refunded. This cannot be undone."
            : "Moving an order backwards is usually a mis-click. The step is recorded in its history either way."
        }
        reasonLabel={
          pendingAction?.kind === "payment"
            ? "Note (optional)"
            : "Reason"
        }
        reasonPlaceholder={
          pendingAction?.to === "cancelled"
            ? "Customer changed their mind…"
            : "Corrected a mis-click…"
        }
        reasonHint={
          pendingAction?.to === "cancelled"
            ? "Required — this is what the shop will see."
            : "Optional, but helpful later."
        }
      />
    </div>
  );
}
