import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  CreditCard,
  Banknote,
  Check,
  Plus,
  Tag,
  ShieldCheck,
  X,
  Loader2,
} from "lucide-react";

import { placeOrder } from "../api/orderApi";
import { validateCoupon } from "../api/couponApi";
import {
  getPaymentConfig,
  createPaymentOrder,
  verifyPayment,
  cancelPaymentOrder,
  loadRazorpay,
} from "../api/paymentApi";
import useAuthStore from "../store/authStore";
import useCartStore from "../store/cartStore";
import { useToast } from "../components/ui/Toast";
import { Spinner } from "../components/ui/Spinner";
import { addAddress, getMe } from "../api/authApi";
import business from "../config/business";

const emptyAddress = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

/** Shared input styling. */
const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-sand-900 transition placeholder:text-sand-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function Checkout() {
  const navigate = useNavigate();
  const toast = useToast();

  const user = useAuthStore((s) => s.user);
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [address, setAddress] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [notes, setNotes] = useState("");

  // Coupon state. `appliedCoupon` is only set once the server confirms the code
  // is usable; `discount`, `shippingCharge` and `total` are always the values
  // the server returned, never computed here.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [quote, setQuote] = useState(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [couponError, setCouponError] = useState("");

  // Monotonic counter identifying the newest quote request.
  const quoteRequest = useRef(0);

  /**
   * A reference identifying one attempt at placing this order.
   *
   * Every retry of the *same* attempt reuses it. The server treats a repeat of
   * a reference it has already seen as the same order and returns it, instead
   * of creating a second one and deducting the stock twice. Disabling the
   * button alone cannot do that — a second tab, or a retry after a response
   * that was lost in transit, both get past it.
   *
   * Generated lazily on first use rather than during render: the value depends
   * on a random source, and a render must be repeatable.
   */
  const clientOrderRef = useRef(null);

  const newOrderRef = () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      // Uniqueness only has to be good enough that two different orders don't
      // collide by accident. The server allowlists the shape regardless, so
      // this is not a security boundary.
      : `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

  /** The reference for the attempt in progress, created on first ask. */
  const orderRefFor = () => {
    if (!clientOrderRef.current) {
      clientOrderRef.current = newOrderRef();
    }

    return clientOrderRef.current;
  };

  /** A genuinely new order gets a new reference, not a replay of the last. */
  const newOrderAttempt = () => {
    clientOrderRef.current = null;
  };

  const cartPayload = useMemo(
    () => items.map((i) => ({ productId: i._id, quantity: i.quantity })),
    [items]
  );

  // Prefill from the signed-in customer, and offer their saved addresses.
  useEffect(() => {
    if (!user) return;

    setAddress((prev) => ({
      ...prev,
      fullName: prev.fullName || user.name || "",
      phone: prev.phone || user.phone || "",
    }));

    getMe()
      .then((fresh) => {
        setSavedAddresses(fresh.addresses || []);
        if (!fresh.addresses?.length) setShowAddressForm(true);
      })
      .catch(() => setShowAddressForm(true));
  }, [user]);

  useEffect(() => {
    getPaymentConfig()
      .then((config) => {
        setRazorpayEnabled(config.razorpayEnabled);
        // Never leave an unavailable method selected.
        if (!config.razorpayEnabled) setPaymentMethod("cod");
      })
      .catch(() => setPaymentMethod("cod"));
  }, []);

  const shipping = quote?.shippingCharge ?? 0;
  const total = quote?.total ?? 0;
  const subtotal = quote?.subtotal ?? 0;

  /**
   * Ask the server what the order will cost, with the code applied.
   *
   * The server is the only thing that prices an order, so the figures shown
   * here are literally the ones that will be charged. On failure we drop the
   * coupon rather than leaving a total that might be wrong.
   */
  const refreshQuote = useCallback(
    async (code) => {
      if (!cartPayload.length) return null;

      // Guard against out-of-order responses. If the customer edits the cart
      // while a quote is in flight, the older reply must not overwrite the
      // newer one — that would show a total for a cart that no longer exists.
      const requestId = ++quoteRequest.current;
      const isCurrent = () => quoteRequest.current === requestId;

      try {
        setCheckingCoupon(true);
        const data = await validateCoupon(cartPayload, code || undefined);

        if (!isCurrent()) return data;

        setQuote(data);
        return data;
      } catch (err) {
        if (!isCurrent()) return null;

        // Never leave a total on screen that we can't vouch for.
        setQuote(null);
        setDiscount(0);
        setAppliedCoupon(null);
        toast.error(err.message);
        return null;
      } finally {
        if (isCurrent()) setCheckingCoupon(false);
      }
    },
    [cartPayload, toast]
  );

  // Keep the quote in step with the cart and the applied code.
  useEffect(() => {
    refreshQuote(appliedCoupon?.code || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartPayload, appliedCoupon?.code]);

  const addressComplete = useMemo(
    () =>
      Boolean(
        address.fullName?.trim() &&
          /^[0-9]{10}$/.test(address.phone || "") &&
          address.line1?.trim() &&
          address.city?.trim() &&
          address.state?.trim()
      ),
    [address]
  );

  const setField = (key) => (e) =>
    setAddress((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setSavingAddress(true);

    try {
      const addresses = await addAddress(address);
      setSavedAddresses(addresses);
      setShowAddressForm(false);
      toast.success("Address saved to your account");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAddress(false);
    }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();

    if (!code) return;

    setCouponError("");

    const data = await refreshQuote(code);

    if (!data) return;

    if (data.valid && data.appliedCoupon) {
      setAppliedCoupon(data.appliedCoupon);
      setDiscount(data.discount);
      setCouponInput("");
      toast.success(
        `${data.appliedCoupon.code} applied — you saved ₹${data.discount.toLocaleString("en-IN")}`
      );
    } else {
      // Don't half-apply: the customer keeps the code in the box to correct it.
      setAppliedCoupon(null);
      setDiscount(0);
      setCouponError(data.message || "That discount code can't be used.");
    }
  };

  const clearCoupon = async () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setDiscount(0);
    setCouponError("");
    await refreshQuote("");
  };

  /** Cash on delivery. */
  const handleCOD = async () => {
    setPlacing(true);

    try {
      const order = await placeOrder({
        items: cartPayload,
        shippingAddress: address,
        paymentMethod: "cod",
        couponCode: appliedCoupon?.code,
        notes,
        // Same reference on a retry, so a request that actually reached the
        // server cannot turn into two orders.
        clientOrderRef: orderRefFor(),
      });

      clearCart();
      // A real new order for the next basket, not a replay of this one.
      newOrderAttempt();
      navigate(`/order-success/${order._id}`, { state: { order } });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  };

  /** Online payment via Razorpay. */
  const handleRazorpay = async () => {
    setPlacing(true);
    let createdOrderId = null;

    try {
      const intent = await createPaymentOrder({
        items: cartPayload,
        shippingAddress: address,
        couponCode: appliedCoupon?.code,
        notes,
      });

      createdOrderId = intent.orderId;

      const Razorpay = await loadRazorpay();

      if (!Razorpay) {
        await cancelPaymentOrder(createdOrderId);
        toast.error("Could not load the payment window. Please try Cash on Delivery.");
        return;
      }

      const options = {
        key: intent.keyId,
        amount: intent.amount * 100,
        currency: "INR",
        name: business.name,
        description: `Order ${intent.orderNumber}`,
        order_id: intent.razorpayOrderId,
        prefill: intent.customer,
        theme: { color: "#268043" },
        modal: {
          ondismiss: async () => {
            // They closed the popup — release the reserved stock.
            try {
              await cancelPaymentOrder(createdOrderId);
              toast.info("Payment cancelled");
            } catch {
              /* nothing to do */
            }
          },
        },
        handler: async (response) => {
          try {
            const order = await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              orderId: createdOrderId,
            });

            clearCart();
            navigate(`/order-success/${order._id}`, { state: { order } });
          } catch (err) {
            toast.error(err.message);
          } finally {
            setPlacing(false);
          }
        },
      };

      new Razorpay(options).open();
    } catch (err) {
      if (createdOrderId) {
        // Payment never started — free the stock back up.
        cancelPaymentOrder(createdOrderId).catch(() => {});
      }
      toast.error(err.message);
      setPlacing(false);
    }
  };

  const handlePlaceOrder = () => {
    if (!addressComplete) {
      toast.error("Please complete your delivery address first.");
      return;
    }

    if (paymentMethod === "razorpay") {
      handleRazorpay();
    } else {
      handleCOD();
    }
  };

  // Nothing to check out.
  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-sand-900">
          Nothing to check out
        </h1>
        <p className="mt-2 text-sand-500">Your cart is empty.</p>
        <Link
          to="/products"
          className="btn-shine mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800"
        >
          Browse products <ArrowRight size={17} />
        </Link>
      </section>
    );
  }

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 text-sm font-semibold text-sand-500 transition hover:text-brand-700"
        >
          <ArrowLeft size={16} />
          Back to cart
        </Link>

        <h1 className="mt-4 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
          Checkout
        </h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-6">
            {/* Delivery address */}
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
                  <MapPin size={20} className="text-brand-600" />
                  Delivery address
                </h2>

                {!showAddressForm && savedAddresses.length > 0 && (
                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                  >
                    <Plus size={15} />
                    New address
                  </button>
                )}
              </div>

              {/* Saved addresses */}
              {savedAddresses.length > 0 && !showAddressForm && (
                <ul className="mt-5 space-y-3">
                  {savedAddresses.map((saved) => {
                    const selected =
                      address.line1 === saved.line1 && address.city === saved.city;

                    return (
                      <li key={saved._id}>
                        <button
                          onClick={() =>
                            setAddress({
                              fullName: saved.fullName || user?.name || "",
                              phone: saved.phone || user?.phone || "",
                              line1: saved.line1,
                              line2: saved.line2 || "",
                              city: saved.city,
                              state: saved.state,
                              pincode: saved.pincode || "",
                            })
                          }
                          className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                            selected
                              ? "border-brand-600 bg-brand-50/50"
                              : "border-sand-200 hover:border-sand-300"
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                              selected
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-sand-300"
                            }`}
                          >
                            {selected && <Check size={12} strokeWidth={3} />}
                          </span>

                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-sand-900">
                              {saved.label} {saved.isDefault && "(default)"}
                            </span>
                            <span className="mt-0.5 block text-sm text-sand-500">
                              {[saved.line1, saved.line2, saved.city, saved.state, saved.pincode]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Address form */}
              {showAddressForm && (
                <form onSubmit={handleSaveAddress} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-sand-700">
                        Full name
                      </label>
                      <input
                        required
                        value={address.fullName}
                        onChange={setField("fullName")}
                        className={`mt-1.5 ${field}`}
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-sand-700">
                        Phone number
                      </label>
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={address.phone}
                        onChange={(e) =>
                          setAddress((p) => ({
                            ...p,
                            phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                        className={`mt-1.5 ${field}`}
                        placeholder="10-digit mobile"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Address line 1
                    </label>
                    <input
                      required
                      value={address.line1}
                      onChange={setField("line1")}
                      className={`mt-1.5 ${field}`}
                      placeholder="House / street"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Address line 2 <span className="font-normal text-sand-400">(optional)</span>
                    </label>
                    <input
                      value={address.line2}
                      onChange={setField("line2")}
                      className={`mt-1.5 ${field}`}
                      placeholder="Landmark, village"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-sm font-semibold text-sand-700">City</label>
                      <input
                        required
                        value={address.city}
                        onChange={setField("city")}
                        className={`mt-1.5 ${field}`}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-sand-700">State</label>
                      <input
                        required
                        value={address.state}
                        onChange={setField("state")}
                        className={`mt-1.5 ${field}`}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-sand-700">Pincode</label>
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={address.pincode}
                        onChange={(e) =>
                          setAddress((p) => ({
                            ...p,
                            pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        className={`mt-1.5 ${field}`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={savingAddress}
                      className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                    >
                      {savingAddress && <Spinner size={15} />}
                      Save &amp; use this
                    </button>

                    {savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-sand-500 transition hover:text-sand-700"
                      >
                        <X size={15} />
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Payment */}
            <div className="card p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
                <CreditCard size={20} className="text-brand-600" />
                Payment method
              </h2>

              <div className="mt-5 space-y-3">
                <PaymentOption
                  selected={paymentMethod === "cod"}
                  onSelect={() => setPaymentMethod("cod")}
                  icon={Banknote}
                  title="Cash on delivery"
                  description="Pay the delivery agent when your order arrives."
                />

                <PaymentOption
                  selected={paymentMethod === "razorpay"}
                  onSelect={() => setPaymentMethod("razorpay")}
                  icon={CreditCard}
                  title="Pay online"
                  description={
                    razorpayEnabled
                      ? "UPI, cards, net banking and wallets."
                      : "Unavailable right now — add Razorpay keys to the backend to enable."
                  }
                  disabled={!razorpayEnabled}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="card p-6">
              <label
                htmlFor="order-notes"
                className="text-sm font-semibold text-sand-700"
              >
                Delivery notes <span className="font-normal text-sand-400">(optional)</span>
              </label>
              <textarea
                id="order-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Please deliver before 6 PM, or call on arrival"
                className={`mt-2 resize-none ${field}`}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="card p-6">
              <h2 className="font-display text-lg font-bold text-sand-900">
                Order summary
              </h2>

              {/* Coupon */}
              <div className="mt-5">
                <label className="text-sm font-semibold text-sand-700">
                  Discount code
                </label>

                {appliedCoupon ? (
                  <div className="mt-2 flex items-start justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold text-brand-700">
                        <Tag size={15} />
                        {appliedCoupon.code}
                        {discount > 0 && (
                          <span className="font-medium text-brand-600">
                            −₹{discount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </span>

                      {appliedCoupon.description && (
                        <span className="mt-0.5 block text-xs text-brand-700/80">
                          {appliedCoupon.description}
                        </span>
                      )}
                    </span>

                    <button
                      onClick={clearCoupon}
                      className="shrink-0 text-brand-600 transition hover:text-brand-800"
                      aria-label="Remove coupon"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      placeholder="Enter code"
                      aria-label="Discount code"
                      className={field}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={!couponInput.trim() || checkingCoupon}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-sand-800 px-4 text-sm font-semibold text-white transition hover:bg-sand-900 disabled:opacity-40"
                    >
                      {checkingCoupon && <Loader2 size={14} className="animate-spin" />}
                      Apply
                    </button>
                  </div>
                )}

                {couponError && (
                  <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                    {couponError}
                  </p>
                )}
              </div>

              {/* Lines */}
              <dl className="mt-6 space-y-3 border-t border-sand-200 pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-sand-600">
                    Subtotal ({items.length} item{items.length === 1 ? "" : "s"})
                  </dt>
                  <dd className="font-semibold text-sand-900">
                    {quote ? `₹${subtotal.toLocaleString("en-IN")}` : "…"}
                  </dd>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-brand-700">Discount</dt>
                    <dd className="font-semibold text-brand-700">
                      −₹{discount.toLocaleString("en-IN")}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-sand-600">Delivery</dt>
                  <dd className="font-semibold text-sand-900">
                    {!quote ? (
                      "…"
                    ) : shipping === 0 ? (
                      <span className="text-brand-700">Free</span>
                    ) : (
                      `₹${shipping.toLocaleString("en-IN")}`
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-baseline justify-between border-t border-sand-200 pt-5">
                <span className="font-semibold text-sand-700">Total</span>
                <span className="font-display text-2xl font-bold text-sand-900">
                  {quote ? `₹${total.toLocaleString("en-IN")}` : "…"}
                </span>
              </div>

              <button
                onClick={handlePlaceOrder}
                // Blocked until the server has confirmed a total for this
                // exact cart, so the customer can never confirm a price we
                // haven't verified.
                disabled={placing || !addressComplete || !quote}
                className="btn-shine mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing…
                  </>
                ) : !quote ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Getting your total…
                  </>
                ) : (
                  <>
                    {paymentMethod === "razorpay" ? (
                      <ShieldCheck size={18} />
                    ) : (
                      <Banknote size={18} />
                    )}
                    {paymentMethod === "razorpay"
                      ? `Pay ₹${total.toLocaleString("en-IN")}`
                      : "Place order"}
                  </>
                )}
              </button>

              {quote && !addressComplete && (
                <p className="mt-3 text-center text-xs text-sand-500">
                  Complete your delivery address to continue.
                </p>
              )}

              <p className="mt-4 text-center text-xs leading-relaxed text-sand-400">
                {paymentMethod === "cod"
                  ? "Pay in cash when your order is delivered."
                  : "You'll be redirected to Razorpay's secure checkout."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Selectable payment method card. */
function PaymentOption({ selected, onSelect, icon: Icon, title, description, disabled }) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${
        disabled
          ? "cursor-not-allowed border-sand-200 bg-sand-100 opacity-60"
          : selected
            ? "border-brand-600 bg-brand-50/50"
            : "border-sand-200 hover:border-sand-300"
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
          selected ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300"
        }`}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </span>

      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-100 text-sand-600">
        <Icon size={19} />
      </span>

      <span>
        <span className="block text-sm font-bold text-sand-900">{title}</span>
        <span className="mt-0.5 block text-sm text-sand-500">{description}</span>
      </span>
    </button>
  );
}
