const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Snapshot the name/price at purchase time so old orders stay accurate
    // even if the product is renamed, repriced or deleted later.
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    unit: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "An order must contain at least one item",
      },
    },

    // A reference the client generates once per checkout attempt, so a repeat
    // submission of the *same* attempt is recognised as the same order rather
    // than a second one.
    //
    // This is what makes double-submit safe. Disabling the button only stops a
    // user clicking twice; it does nothing about a second tab, a retry after a
    // timeout, or a request the server actually received while the response
    // was lost. Each of those would otherwise create a second order and deduct
    // the stock twice.
    //
    // Deliberately has no `default: null`. A default would write the field on
    // every order, and a unique index treats an explicit null as a value — so
    // every order without a reference would collide with every other one.
    // Left undefined, those documents fall outside the partial index below.
    clientOrderRef: {
      type: String,
      // Bounded generously but not unbounded, so a junk value can't bloat the
      // index. The client sends a UUID.
      maxlength: [64, "Client order reference is too long"],
    },

    // Full snapshot of the delivery address for this order.
    shippingAddress: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay"],
      default: "cod",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    // Set when a Razorpay payment is created/verified.
    razorpayOrderId: {
      type: String,
      default: "",
    },
    razorpayPaymentId: {
      type: String,
      default: "",
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",      // placed, not yet confirmed
        "confirmed",    // accepted by the shop
        "packed",       // ready to dispatch
        "shipped",      // out for delivery
        "delivered",    // completed
        "cancelled",    // cancelled
      ],
      default: "pending",
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    cancelledReason: {
      type: String,
      default: "",
    },

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * One order per clientOrderRef.
 *
 * Sparse, so every order that has no client reference (all of them, before
 * this field existed) is exempt and the index has nothing to compare. This is
 * the last line of defence for double submission: `createOrder` checks first
 * and returns the original, and if two identical requests ever slipped past
 * that check and raced, the second insert fails here rather than creating a
 * duplicate order.
 */
// Partial rather than plain `sparse`, and the distinction matters.
//
// A sparse unique index still treats an explicit `null` as an indexed value,
// so with a default of null every order without a reference would collide with
// every other one — which is exactly what happened before this was changed.
// A partial index that only covers documents where the field is actually a
// string exempts them properly.
orderSchema.index(
  { clientOrderRef: 1 },
  {
    unique: true,
    partialFilterExpression: { clientOrderRef: { $type: "string" } },
  }
);

// "My orders", newest first, filtered by user. The same index serves the
// admin's unfiltered newest-first list through its leading sort key.
orderSchema.index({ user: 1, createdAt: -1 });

// The admin list filters by status, so a compound index beats scanning.
orderSchema.index({ orderStatus: 1, createdAt: -1 });

// Auto-generate a human-friendly order number like "KE-6X4T9Q".
orderSchema.pre("validate", async function () {
  if (this.orderNumber) return;

  let candidate;
  do {
    candidate =
      "KE-" +
      Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 6).toUpperCase();
  } while (await mongoose.models.Order.exists({ orderNumber: candidate }));

  this.orderNumber = candidate;
});

module.exports = mongoose.model("Order", orderSchema);
