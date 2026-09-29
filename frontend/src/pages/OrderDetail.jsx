import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Package,
  XCircle,
  Phone,
  Check,
  Clock,
  Truck,
  Loader2,
  Star,
} from "lucide-react";

import { getOrderById, cancelOrder } from "../api/orderApi";
import { createReview } from "../api/reviewApi";
import ProductImage from "../components/ui/ProductImage";
import Rating from "../components/ui/Rating";
import { OrderStatusBadge, PaymentStatusBadge, ORDER_STEPS } from "../components/ui/Badge";
import { ErrorState } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import business from "../config/business";

const STEP_ICONS = {
  pending: Clock,
  confirmed: Check,
  packed: Package,
  shipped: Truck,
  delivered: Check,
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getOrderById(id);
      setOrder(data.order);
      setReviewedIds(data.reviewedProductIds || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;

    setCancelling(true);

    try {
      const updated = await cancelOrder(order._id, "Cancelled from the website");
      setOrder(updated);
      toast.success("Your order has been cancelled");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);

    try {
      await createReview({
        productId: reviewing.productId,
        rating: reviewRating,
        comment: reviewComment,
      });

      setReviewedIds((prev) => [...prev, String(reviewing.productId)]);
      setReviewing(null);
      setReviewComment("");
      setReviewRating(5);

      toast.success("Thanks for your review!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <ErrorState message={error || "Order not found"} onRetry={load} />
      </div>
    );
  }

  const canCancel = ["pending", "confirmed", "packed"].includes(order.orderStatus);
  const isCancelled = order.orderStatus === "cancelled";
  const currentStep = ORDER_STEPS.indexOf(order.orderStatus);

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/orders")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-sand-500 transition hover:text-brand-700"
        >
          <ArrowLeft size={16} />
          All orders
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-5 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Order details
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold text-sand-900">
              {order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-sand-500">
              Placed on{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <OrderStatusBadge status={order.orderStatus} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </motion.div>

        {/* Progress tracker */}
        {!isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card mt-8 p-6"
          >
            <h2 className="font-display text-lg font-bold text-sand-900">
              Delivery progress
            </h2>

            <ol className="mt-6 flex items-start">
              {ORDER_STEPS.map((step, i) => {
                const done = i <= currentStep;
                const Icon = STEP_ICONS[step];

                return (
                  <li key={step} className="relative flex flex-1 flex-col items-center text-center">
                    {i < ORDER_STEPS.length - 1 && (
                      <span className="absolute left-1/2 top-5 h-1 w-full bg-sand-200">
                        <motion.span
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: i < currentStep ? 1 : 0 }}
                          style={{ originX: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                          className="block h-full w-full bg-brand-500"
                        />
                      </span>
                    )}

                    <motion.span
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 260 }}
                      className={`relative z-10 grid h-10 w-10 place-items-center rounded-full ring-4 ring-white ${
                        done ? "bg-brand-600 text-white" : "bg-sand-200 text-sand-400"
                      }`}
                    >
                      <Icon size={18} />
                    </motion.span>

                    <span
                      className={`mt-2.5 text-xs font-semibold capitalize ${
                        done ? "text-brand-700" : "text-sand-400"
                      }`}
                    >
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}

        {isCancelled && (
          <div className="mt-8 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
            <XCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">This order was cancelled</p>
              {order.cancelledReason && (
                <p className="mt-1 text-sm text-red-700">{order.cancelledReason}</p>
              )}
            </div>
          </div>
        )}

        {/* Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="card mt-6 overflow-hidden"
        >
          <div className="border-b border-sand-200 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-sand-900">Items</h2>
          </div>

          <ul className="divide-y divide-sand-100">
            {order.items.map((item) => {
              const productId = String(item.product?._id || item.product);
              const alreadyReviewed = reviewedIds.includes(productId);
              const canReview = order.orderStatus === "delivered" && !alreadyReviewed;

              return (
                <li key={productId} className="p-6">
                  <div className="flex items-center gap-4">
                    <Link
                      to={`/products/${item.product?.slug || productId}`}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-100"
                    >
                      <ProductImage
                        src={item.image}
                        alt=""
                        name={item.name}
                        className="h-full w-full object-cover"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/products/${item.product?.slug || productId}`}
                        className="font-semibold text-sand-900 transition hover:text-brand-700"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-sand-500">
                        {item.unit} · Qty {item.quantity} · ₹{item.price} each
                      </p>
                    </div>

                    <p className="shrink-0 font-bold text-sand-900">
                      ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                    </p>
                  </div>

                  {order.orderStatus === "delivered" && (
                    <div className="mt-3 pl-20">
                      {alreadyReviewed ? (
                        <p className="text-sm text-brand-700">
                          ✓ You reviewed this product
                        </p>
                      ) : canReview ? (
                        reviewing?.productId === productId ? (
                          <form onSubmit={handleReview} className="space-y-3">
                            <Rating
                              value={reviewRating}
                              interactive
                              onChange={setReviewRating}
                            />

                            <textarea
                              rows={3}
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="How did it perform?"
                              className="w-full resize-none rounded-xl border border-sand-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                            />

                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={submittingReview}
                                className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                              >
                                {submittingReview && <Loader2 size={14} className="animate-spin" />}
                                Submit
                              </button>
                              <button
                                type="button"
                                onClick={() => setReviewing(null)}
                                className="rounded-xl px-3 py-2 text-sm font-semibold text-sand-500 transition hover:text-sand-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            onClick={() => {
                              setReviewing({ productId });
                              setReviewRating(5);
                              setReviewComment("");
                            }}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                          >
                            <Star size={15} />
                            Write a review
                          </button>
                        )
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Totals */}
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
                {order.shippingCharge === 0 ? "Free" : `₹${order.shippingCharge}`}
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

        {/* Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="card mt-6 p-6"
        >
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
            <MapPin size={19} className="text-brand-600" />
            Delivery address
          </h2>

          <address className="mt-4 not-italic leading-relaxed text-sand-600">
            <p className="font-semibold text-sand-900">
              {order.shippingAddress.fullName}
            </p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.pincode}
            </p>
            <a
              href={`tel:${order.shippingAddress.phone}`}
              className="mt-2 inline-flex items-center gap-2 font-semibold text-brand-700 transition hover:text-brand-800"
            >
              <Phone size={15} />
              {order.shippingAddress.phone}
            </a>
          </address>

          {order.notes && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-sand-700">
                Delivery notes
              </h3>
              <p className="mt-1 text-sm text-sand-600">{order.notes}</p>
            </>
          )}
        </motion.div>

        {/* Actions */}
        {canCancel && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-3.5 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {cancelling ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <XCircle size={17} />
              )}
              Cancel order
            </button>

            {business.phone && (
              <a
                href={`tel:${business.phone.replace(/\s/g, "")}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white py-3.5 font-semibold text-sand-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                <Phone size={17} />
                Contact the shop
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
