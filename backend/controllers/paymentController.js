const crypto = require("crypto");

const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const {
  quoteOrder,
  validateAddress,  reserveStock,
  releaseStock,
} = require("../utils/orderHelpers");

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_API = "https://api.razorpay.com/v1";

// When Razorpay isn't configured the site simply runs in COD-only mode.
const isRazorpayEnabled = Boolean(KEY_ID && KEY_SECRET);

/** GET /api/payments/config — tells the frontend whether to show online payment. */
const getConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    razorpayEnabled: isRazorpayEnabled,
    keyId: isRazorpayEnabled ? KEY_ID : null,
  });
});

/** POST https://api.razorpay.com/v1/orders */
const createRazorpayOrder = async (amountInPaise, receipt) => {
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      payment_capture: 1, // capture immediately, no manual step
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Razorpay order creation failed:", detail);
    throw new AppError("Could not start the payment. Please try again.", 502);
  }

  return response.json();
};

/**
 * POST /api/payments/create-order   (protected)
 *
 * Creates a Razorpay order and a matching local Order in "pending" state,
 * reserving the stock up front. If the customer abandons the checkout the
 * frontend calls /cancel to release it.
 */
const createPaymentOrder = asyncHandler(async (req, res) => {
  if (!isRazorpayEnabled) {
    throw new AppError("Online payment is not available. Please choose Cash on Delivery.", 400);
  }

  const { items, couponCode, notes } = req.body;
  const shippingAddress = validateAddress(req.body.shippingAddress);

  // Same quote function as COD and as the checkout preview, so the amount
  // shown, reserved and charged always agree.
  const {
    items: orderItems,
    subtotal,
    discount,
    shippingCharge,
    total,
    appliedCoupon,
  } = await quoteOrder(items, couponCode);

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    subtotal,
    discount,
    shippingCharge,
    total,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    orderStatus: "pending",
    notes: notes || "",
  });

  try {
    await reserveStock(orderItems, { orderId: order._id });
  } catch (error) {
    await Order.findByIdAndDelete(order._id);

    if (error.statusCode === 409) throw error;

    throw new AppError("Could not reserve stock. Please try again.", 500);
  }

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(total * 100, order.orderNumber);
  } catch (error) {
    // Payment gateway rejected us — undo the local order and free the stock.
    await Order.findByIdAndDelete(order._id);
    await releaseStock(orderItems, {
      orderId: order._id,
      reason: `Payment failed for ${order.orderNumber}, stock released`,
    });
    throw error;
  }

  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  if (appliedCoupon) {
    await Coupon.updateOne(
      { _id: appliedCoupon._id },
      { $inc: { usedCount: 1 } }
    );
  }

  res.status(201).json({
    success: true,
    message: "Payment order created",
    orderId: order._id,
    orderNumber: order.orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amount: total,
    keyId: KEY_ID,
    customer: {
      name: req.user.name,
      email: req.user.email,
      contact: req.user.phone,
    },
  });
});

/**
 * POST /api/payments/verify   (protected)
 *
 * Confirms the payment actually happened by checking Razorpay's HMAC
 * signature. Never trust the client's "payment successful" callback alone.
 */
const verifyPayment = asyncHandler(async (req, res) => {
  if (!isRazorpayEnabled) {
    throw new AppError("Online payment is not configured", 400);
  }

  const { razorpayOrderId, razorpayPaymentId, signature, orderId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !signature) {
    throw new AppError("Incomplete payment response", 400);
  }

  const expectedSignature = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const isValid =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!isValid) {
    throw new AppError("Payment verification failed", 400);
  }

  const order = await Order.findById(orderId);

  if (!order) throw new AppError("Order not found", 404);
  if (String(order.user) !== String(req.user._id)) {
    throw new AppError("You do not have permission for this order", 403);
  }
  if (order.razorpayOrderId !== razorpayOrderId) {
    throw new AppError("Payment does not match this order", 400);
  }

  // Replay protection: verifying the same payment twice is a no-op.
  if (order.paymentStatus === "paid") {
    return res.json({ success: true, message: "Payment already confirmed", order });
  }

  order.paymentStatus = "paid";
  order.razorpayPaymentId = razorpayPaymentId;
  order.orderStatus = "confirmed";

  await order.save();

  res.json({ success: true, message: "Payment successful", order });
});

/** POST /api/payments/cancel   (protected) — customer closed the Razorpay popup. */
const cancelPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.body.orderId);

  if (!order) throw new AppError("Order not found", 404);
  if (String(order.user) !== String(req.user._id)) {
    throw new AppError("You do not have permission for this order", 403);
  }

  // Only abandon it if payment never succeeded.
  if (order.paymentStatus === "paid") {
    throw new AppError("This order has already been paid", 400);
  }

  if (order.orderStatus !== "cancelled") {
    order.orderStatus = "cancelled";
    order.cancelledReason = "Payment was not completed";
    await releaseStock(order.items, {
      orderId: order._id,
      reason: `Payment not completed for ${order.orderNumber}, stock released`,
    });
    await order.save();
  }

  res.json({ success: true, message: "Order cancelled" });
});

module.exports = {
  getConfig,
  createPaymentOrder,
  verifyPayment,
  cancelPayment,
};
