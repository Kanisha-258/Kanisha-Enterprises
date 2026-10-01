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
const {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  CANCELLABLE_STATUSES,
  isOrderStatus,
  isCancellable,
  canTransition,
  nextStatuses,
  describeTransition,
} = require("../utils/orderStatus");

/**
 * The client's reference for one checkout attempt, or null.
 *
 * Strictly validated rather than passed through, because it is used as a
 * uniqueness key: an arbitrary string here could be crafted to collide with
 * somebody else's order reference. UUID-shaped or nothing.
 */
const readClientOrderRef = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const ref = String(value).trim();

  if (!/^[a-z\d-]{8,64}$/i.test(ref)) {
    throw new AppError("Invalid order reference", 400);
  }

  return ref;
};

// POST /api/orders   (protected) — place an order
const createOrder = asyncHandler(async (req, res) => {
  const { items, paymentMethod, couponCode, notes } = req.body;
  const clientOrderRef = readClientOrderRef(req.body?.clientOrderRef);

  // A repeat of an attempt that already succeeded returns the order that
  // exists, rather than creating a second one. Checked before anything else so
  // a double submit costs one indexed lookup instead of a full re-quote and a
  // second stock deduction.
  if (clientOrderRef) {
    const existing = await Order.findOne({ clientOrderRef, user: req.user._id });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Order already placed",
        duplicate: true,
        order: existing,
      });
    }
  }

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

  let order;

  try {
    order = await Order.create({
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
      // Only written when the client sent one. Setting the field to null
      // explicitly would put every ref-less order inside the unique index.
      ...(clientOrderRef ? { clientOrderRef } : {}),
    });
  } catch (error) {
    // Two identical requests can both pass the lookup above and only collide
    // at the unique index — a genuine race. The loser didn't create anything,
    // so hand back the winner's order instead of surfacing a 409 the customer
    // would read as a failure.
    if (error.code === 11000 && clientOrderRef) {
      const winner = await Order.findOne({ clientOrderRef, user: req.user._id });

      if (winner) {
        return res.status(200).json({
          success: true,
          message: "Order already placed",
          duplicate: true,
          order: winner,
        });
      }
    }

    throw error;
  }

  // Reserve stock after the insert; if anything fails, roll the order back
  // rather than overselling. Each deduction also writes a SALE row to the
  // stock ledger, so every unit leaving the shop is accounted for.
  try {
    await reserveStock(orderItems, { orderId: order._id });
  } catch (error) {
    await Order.findByIdAndDelete(order._id);

    // "Only N left" is useful to the customer; anything else is our problem.
    if (error.statusCode === 409) throw error;

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
    if (!isOrderStatus(req.query.status)) {
      throw new AppError("Invalid order status filter", 400);
    }
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
    .populate("user", "name email phone userType")
    .populate("items.product", "name image slug");

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

  res.json({
    success: true,
    order,
    reviewedProductIds,
    // The API decides whether a cancel button should appear, instead of the
    // frontend hardcoding the same list of statuses a second time. The two
    // copies were already duplicated and could only ever agree by luck.
    canCancel: canTransition(order.orderStatus, "cancelled"),
    // And says why not, so the UI can explain instead of just hiding a button.
    cancelBlockedReason: isCancellable(order.orderStatus)
      ? null
      : describeTransition(order.orderStatus, "cancelled"),
    // The statuses an admin may pick right now, so the dropdown can only offer
    // moves the API will accept.
    availableTransitions: nextStatuses(order.orderStatus),
  });
});

// --- Shared lifecycle helpers ------------------------------------------------

/**
 * One entry in an order's payment history.
 *
 * Same shape as a status event, because it answers the same question — who
 * changed what, and when — about money rather than about dispatch. Separate
 * arrays so the two never get mixed up in a timeline.
 */
const buildPaymentEvent = ({
  paymentStatus,
  actorId = null,
  actorRole = "system",
  note = "",
}) => ({
  paymentStatus,
  at: new Date(),
  by: actorId,
  actorRole,
  note,
});

/**
 * Append one entry to an order's status history.
 *
 * Kept as a plain object pushed onto the array rather than a method, because
 * the events are written in the same `$set`/`$push` as the status change
 * itself where possible, and a half-written status with a missing history row
 * is worse than the other way round.
 */
const buildStatusEvent = ({
  status,
  actorId = null,
  actorRole = "system",
  note = "",
}) => ({
  status,
  at: new Date(),
  by: actorId,
  actorRole,
  note,
});

/**
 * Claim an order for cancellation, atomically.
 *
 * This is the fix for a real, reproducible bug. Cancellation used to be
 * check-then-act: read the order, confirm the status was cancellable, then
 * restore stock. Two requests arriving together both passed the check before
 * either had saved, so both restored the stock. The StockMovement unique index
 * then rejected the second ledger row — but only *after* `applyStockChange`
 * had already run its `$inc` — so stock ended up incremented twice while the
 * ledger recorded one movement, and the customer saw a duplicate-key error
 * ("That product is already in use") instead of "already cancelled".
 *
 * Matching on `orderStatus: { $in: CANCELLABLE_STATUSES }` makes the claim a
 * compare-and-set: whichever request the database gets to first wins, and the
 * other finds nothing to update and is told the order is already cancelled.
 *
 * Returns the claimed order, or null if another request got there first.
 */
const claimCancellation = (orderId, reason) =>
  Order.findOneAndUpdate(
    { _id: orderId, orderStatus: { $in: CANCELLABLE_STATUSES } },
    { $set: { orderStatus: "cancelled", cancelledReason: reason } },
    { new: true }
  );

/**
 * Turn a lost cancellation claim into a message that explains itself.
 *
 * Distinguishes "someone else already cancelled this" from "this reached a
 * stage where cancellation is not allowed", because the two mean very
 * different things to whoever clicked.
 *
 * `conflictStatus` differs by caller, deliberately. The customer-facing cancel
 * route answers 400, which is the contract it has always had — a customer whose
 * order has shipped has submitted a request that cannot be satisfied, not one
 * that collided with a concurrent write. The admin status route answers 409,
 * where losing the race genuinely is a conflict with the current state and the
 * admin UI benefits from telling "someone else just did this" apart from "that
 * move is not allowed".
 */
const explainLostClaim = async (orderId, conflictStatus = 409) => {
  const current = await Order.findById(orderId).select("orderStatus").lean();

  if (!current) throw new AppError("Order not found", 404);

  if (current.orderStatus === "cancelled") {
    throw new AppError("This order has already been cancelled", conflictStatus);
  }

  throw new AppError(
    describeTransition(current.orderStatus, "cancelled"),
    conflictStatus
  );
};

/**
 * Put an order back to where it was, if cancelling it failed.
 *
 * `applyStockChanges` rolls back its own work when a movement insert fails, so
 * the only thing left to undo is the status claim. Without this an order that
 * could not be restocked would sit at "cancelled" with its stock still out of
 * the warehouse, and the shop would have no way to void it.
 */
const releaseCancellationClaim = (order, previousStatus) =>
  Order.updateOne(
    {
      _id: order._id,
      orderStatus: "cancelled",
      cancelledReason: order.cancelledReason,
    },
    { $set: { orderStatus: previousStatus, cancelledReason: "" } }
  );

/**
 * Cancel an order and return its stock, at most once.
 *
 * Both the customer's cancel endpoint and the admin's status update go through
 * here, so there is one implementation of "cancelling restores inventory" and
 * one place where that can be wrong.
 *
 * `previousStatus` is captured by the caller before claiming, because it is
 * what the order reverts to if the restock fails.
 */
const cancelAndRestock = async ({
  order,
  reason,
  performedBy,
  actorRole,
  note,
  refundIfPaid,
  conflictStatus = 409,
}) => {
  const previousStatus = order.orderStatus;

  const claimed = await claimCancellation(order._id, reason);

  if (!claimed) await explainLostClaim(order._id, conflictStatus);

  try {
    // Only restore if this order actually took stock in the first place. An
    // order whose payment failed never had a SALE movement written for it.
    if (claimed.paymentStatus !== "failed") {
      await releaseStock(claimed.items, {
        orderId: claimed._id,
        performedBy: performedBy || null,
        reason: `Order ${claimed.orderNumber} cancelled: ${claimed.cancelledReason}`,
      });
    }

    // Money taken for goods that will now not be sent goes back. Refunding is
    // recorded as payment state, not as an order status change.
    if (refundIfPaid && claimed.paymentStatus === "paid") {
      claimed.paymentStatus = "refunded";
      claimed.paymentHistory.push(
        buildPaymentEvent({
          paymentStatus: "refunded",
          actorId: performedBy || null,
          actorRole,
          note: "Refunded automatically when the order was cancelled",
        })
      );
    }

    claimed.statusHistory.push(
      buildStatusEvent({
        status: "cancelled",
        actorId: performedBy || null,
        actorRole,
        note: note || claimed.cancelledReason,
      })
    );

    await claimed.save();
  } catch (error) {
    await releaseCancellationClaim(claimed, previousStatus);
    throw error;
  }

  return claimed;
};

// PUT /api/orders/:id/cancel   (protected) — customer or admin
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) throw new AppError("Order not found", 404);

  const isOwner = String(order.user) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    throw new AppError("You do not have permission to change this order", 403);
  }

  // A customer cancelling is their own business. An admin cancelling is a
  // decision on the shop's behalf and needs a reason on the record.
  const isAdmin = req.user.role === "admin";
  const reason = String(req.body?.reason || "").trim();

  if (isAdmin && !reason) {
    throw new AppError(
      "Please record why this order is being cancelled",
      400
    );
  }

  const cancelled = await cancelAndRestock({
    order,
    reason: reason || "Cancelled by customer",
    performedBy: isAdmin ? req.user._id : null,
    actorRole: isAdmin ? "admin" : "customer",
    // Each returned unit writes a SALE_CANCEL row, so the ledger shows the
    // stock going out and coming back rather than silently reappearing.
    note: reason || "Cancelled by customer",
    // A customer cancelling their own order is not a refund of shop revenue;
    // only the admin path decides money moves.
    refundIfPaid: isAdmin,
    // 400, the contract this route has always returned. Three existing suites
    // assert it and nothing about the behaviour behind it has changed.
    conflictStatus: 400,
  });

  res.json({ success: true, message: "Order cancelled", order: cancelled });
});

// --- Admin ---

// GET /api/orders/admin/all   (protected + admin)
const getAllOrders = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};
  if (req.query.status && req.query.status !== "all") {
    if (!isOrderStatus(req.query.status)) {
      throw new AppError("Invalid order status filter", 400);
    }
    filter.orderStatus = req.query.status;
  }

  // Payment state is filterable separately, because "delivered but unpaid" and
  // "cancelled but refunded" are the two questions a shop actually opens this
  // list to answer, and neither can be expressed with a status filter.
  if (req.query.paymentStatus && req.query.paymentStatus !== "all") {
    if (!PAYMENT_STATUSES.includes(req.query.paymentStatus)) {
      throw new AppError("Invalid payment status filter", 400);
    }
    filter.paymentStatus = req.query.paymentStatus;
  }

  if (req.query.search) {
    const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    filter.$or = [
      { orderNumber: rx },
      { "shippingAddress.fullName": rx },
      { "shippingAddress.phone": rx },
    ];
  }

  // Only two orders of it, and both ways. Anything else would be a sort nobody
  // uses that quietly costs an index.
  const sortDirection = req.query.sort === "oldest" ? 1 : -1;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email phone userType")
      .sort({ createdAt: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  // Merged in rather than stored, so the legal moves are always whatever the
  // rules currently say. Each admin row builds a dropdown from this instead of
  // from a hardcoded list of all six statuses.
  const rows = orders.map((order) => ({
    ...order.toObject(),
    availableTransitions: nextStatuses(order.orderStatus),
    canCancel: canTransition(order.orderStatus, "cancelled"),
  }));

  res.json({
    success: true,
    count: rows.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    orders: rows,
  });
});

// PUT /api/orders/admin/:id/status   (protected + admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus } = req.body;

  // Reject an unknown status before looking anything up, so a typo is reported
  // as a typo rather than as a confusing "cannot change a delivered order".
  if (!isOrderStatus(orderStatus)) {
    throw new AppError(
      `"${orderStatus}" is not a valid order status. Expected one of: ${ORDER_STATUSES.join(", ")}.`,
      400
    );
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  const from = order.orderStatus;

  // The lifecycle rules, in one place, with a message an admin can act on.
  const blocked = describeTransition(from, orderStatus);
  if (blocked) throw new AppError(blocked, 409);

  // `note` is the name this endpoint now prefers, because the note is stored on
  // a history entry for any status — not just a cancellation. `cancelledReason`
  // is still read so the older callers that send it keep meaning something
  // rather than silently falling back to a generic string.
  const adminNote = String(req.body?.note || req.body?.cancelledReason || "").trim();
  const performedBy = req.user._id;

  // Cancelling goes through the shared path so it inherits the atomic claim and
  // the refund handling. Everything else is a plain status change.
  if (orderStatus === "cancelled") {
    // Required, not optional. A void puts stock back into the warehouse and may
    // refund money; "cancelled by the shop" on every one of those is not a
    // record that can settle a disagreement later.
    if (!adminNote) {
      throw new AppError(
        "Please record why this order is being cancelled",
        400
      );
    }

    const cancelled = await cancelAndRestock({
      order,
      reason: adminNote,
      performedBy,
      actorRole: "admin",
      note: adminNote,
      refundIfPaid: true,
    });

    return res.json({
      success: true,
      message: "Order cancelled and stock returned to inventory",
      order: cancelled,
    });
  }

  // Compare-and-set on the status we just read. Two admins acting on the same
  // order at once would otherwise both save, and the second would silently
  // overwrite the first's decision — including a stock-related one.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, orderStatus: from },
    {
      $set: {
        orderStatus,
        // Leaving delivered clears the marker. Delivered cannot be exited
        // anyway, so this only ever fires on a backwards move within the flow.
        ...(orderStatus === "delivered"
          ? { deliveredAt: new Date() }
          : { deliveredAt: null }),
      },
      $push: {
        statusHistory: buildStatusEvent({
          status: orderStatus,
          actorId: performedBy,
          actorRole: "admin",
          note: adminNote || `Moved from ${from} to ${orderStatus}`,
        }),
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError(
      "This order was changed by someone else while you were looking at it. Reload and try again.",
      409
    );
  }

  // A cash order is collected on handover, not before. Recording it here rather
  // than trusting a button in the UI is the point: the admin genuinely
  // delivered it, so the money genuinely arrived.
  if (orderStatus === "delivered" && updated.paymentMethod === "cod" && updated.paymentStatus !== "paid") {
    updated.paymentStatus = "paid";
    updated.paymentHistory.push(
      buildPaymentEvent({
        paymentStatus: "paid",
        actorId: performedBy,
        actorRole: "admin",
        note: "Marked paid on delivery — cash collected",
      })
    );
    await updated.save();
  }

  res.json({ success: true, message: "Order status updated", order: updated });
});

// PUT /api/orders/admin/:id/payment   (protected + admin)
//
// Deliberately narrow. An online payment is whatever Razorpay's verified
// webhook says it is, and a shopkeeper must not be able to type "paid" over a
// Razorpay order that never settled. So this can only record cash actually
// collected, and can only move a cash order's state.
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, note } = req.body;

  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new AppError(
      `"${paymentStatus}" is not a valid payment status. Expected one of: ${PAYMENT_STATUSES.join(", ")}.`,
      400
    );
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  if (order.paymentMethod !== "cod") {
    throw new AppError(
      "Online payments are recorded by the payment provider once Razorpay confirms them, and cannot be changed here.",
      400
    );
  }

  if (order.paymentStatus === paymentStatus) {
    throw new AppError(`This order is already marked ${paymentStatus}`, 409);
  }

  // Once money has gone back, it cannot be un-refunded into "unpaid" — that
  // would contradict the refund itself and quietly lose an amount of money.
  if (order.paymentStatus === "refunded") {
    throw new AppError(
      "A refunded order cannot change payment status. Create a new order if the customer buys again.",
      409
    );
  }

  // Payment state follows delivery for a cash order. Marking it paid while the
  // goods are still on the shelf records money that has not been collected.
  if (paymentStatus === "paid" && !["shipped", "delivered"].includes(order.orderStatus)) {
    throw new AppError(
      "Mark a cash order paid only once it has shipped or been delivered",
      400
    );
  }

  const from = order.paymentStatus;
  const adminNote = String(note || "").trim();

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: from },
    {
      $set: { paymentStatus },
      $push: {
        paymentHistory: buildPaymentEvent({
          paymentStatus,
          actorId: req.user._id,
          actorRole: "admin",
          note: adminNote || `Marked ${from} → ${paymentStatus}`,
        }),
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new AppError(
      "This order's payment status was changed by someone else. Reload and try again.",
      409
    );
  }

  res.json({
    success: true,
    message: `Payment status updated to ${paymentStatus}`,
    order: updated,
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
};
