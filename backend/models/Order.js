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
