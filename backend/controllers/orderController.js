const Order = require("../models/Order");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const Review = require("../models/Review");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const { toPage, toLimit } = require("../utils/validators");
const {
  quoteOrder,
  validateAddress,
  reserveStock,
  releaseStock,
} = require("../utils/orderHelpers");

// An order can no longer be changed once it has left the shop.
const CANCELLABLE_STATUSES = ["pending", "confirmed", "packed"];

// POST /api/orders   (protected) — place an order
const createOrder = asyncHandler(async (req, res) => {
  const { items, paymentMethod, couponCode, notes } = req.body;

  if (!["cod", "razorpay"].includes(paymentMethod)) {
    throw new AppError("Choose a valid payment method", 400);
  }

  // Razorpay has its own two-phase flow (create-order then verify).
  // See paymentController.
  if (paymentMethod === "razorpay") {
    throw new AppError("Use the payment flow to pay online", 400);
  }

  const shippingAddress = validateAddress(req.body.shippingAddress);

  // quoteOrder is the exact function the checkout preview endpoint calls, so
  // the total the customer was shown is by construction the total charged here.
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
    paymentMethod,
    paymentStatus: "pending",
    orderStatus: "pending",
    notes: notes || "",
  });

  // Reserve stock after the insert; if anything fails, roll the order back
  // rather than overselling.
  try {
    await reserveStock(orderItems);
  } catch (error) {
    await Order.findByIdAndDelete(order._id);
    throw new AppError("Could not reserve stock. Please try again.", 500);
  }

  if (appliedCoupon) {
    await Coupon.updateOne(
      { _id: appliedCoupon._id },
      { $inc: { usedCount: 1 } }
    );
  }

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order,
  });
});

// GET /api/orders   (protected) — the customer's own orders
const getMyOrders = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 10, 50);

  const filter = { user: req.user._id };
  if (req.query.status && req.query.status !== "all") {
    filter.orderStatus = req.query.status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: orders.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    orders,
  });
});

// GET /api/orders/:id   (protected) — owner or admin
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email phone")
    .populate("items.product", "name image");

  if (!order) throw new AppError("Order not found", 404);

  const isOwner =
    order.user && String(order.user._id) === String(req.user._id);

  if (!isOwner && req.user.role !== "admin") {
    throw new AppError("You do not have permission to view this order", 403);
  }

  // Lets the UI show a "write a review" link on delivered items.
  const reviewedProductIds = (
    await Review.find({
      user: req.user._id,
      product: { $in: order.items.map((i) => i.product) },
    })
      .select("product")
      .lean()
  ).map((r) => String(r.product));

  res.json({ success: true, order, reviewedProductIds });
});

// PUT /api/orders/:id/cancel   (protected) — customer or admin
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) throw new AppError("Order not found", 404);

  const isOwner = String(order.user) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    throw new AppError("You do not have permission to change this order", 403);
  }

  if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
    throw new AppError(
      `An order that is already "${order.orderStatus}" can no longer be cancelled. Please contact us.`,
      400
    );
  }

  order.orderStatus = "cancelled";
  order.cancelledReason = req.body?.reason || "Cancelled by customer";

  await releaseStock(order.items);
  await order.save();

  res.json({ success: true, message: "Order cancelled", order });
});

// --- Admin ---

// GET /api/orders/admin/all   (protected + admin)
const getAllOrders = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};
  if (req.query.status && req.query.status !== "all") {
    filter.orderStatus = req.query.status;
  }
  if (req.query.search) {
    const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    filter.$or = [
      { orderNumber: rx },
      { "shippingAddress.fullName": rx },
      { "shippingAddress.phone": rx },
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: orders.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    orders,
  });
});

// PUT /api/orders/admin/:id/status   (protected + admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, cancelledReason } = req.body;

  const valid = ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"];
  if (!valid.includes(orderStatus)) {
    throw new AppError("Invalid order status", 400);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  const wasCancelled = order.orderStatus === "cancelled";
  const wasDelivered = order.orderStatus === "delivered";

  order.orderStatus = orderStatus;

  if (orderStatus === "delivered") {
    order.deliveredAt = new Date();
    // A delivered cash order counts as collected.
    if (order.paymentMethod === "cod") order.paymentStatus = "paid";
  }

  // Moving a delivered order back to an earlier state clears the marker.
  if (!wasDelivered && orderStatus !== "delivered") {
    order.deliveredAt = null;
  }

  if (orderStatus === "cancelled") {
    order.cancelledReason = cancelledReason || "Cancelled by the shop";
    if (!wasCancelled) {
      await releaseStock(order.items);
      // Refund an already-paid order so the finance numbers stay honest.
      if (order.paymentStatus === "paid") order.paymentStatus = "refunded";
    }
  }

  await order.save();

  res.json({ success: true, message: "Order status updated", order });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
};
