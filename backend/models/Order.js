const mongoose = require("mongoose");

/**
 * One step in an order's payment history.
 *
 * Deliberately separate from the status event schema: the field name differs so
 * a payment entry can never be mistaken for a status entry, and payment state
 * has its own vocabulary.
 */
const paymentStatusEventSchema = new mongoose.Schema(
  {
    paymentStatus: {
      type: String,
      required: [true, "A payment event must name a payment status"],
    },
    at: {
      type: Date,
      default: Date.now,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorRole: {
      type: String,
      enum: ["customer", "admin", "system"],
      default: "system",
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Note cannot exceed 300 characters"],
    },
  },
  { _id: false, timestamps: false }
);

/**
 * One step in an order's status history.
 *
 * A separate schema rather than raw objects so the shape is enforced and the
 * API can populate the actor without the field accepting anything at all.
 */
const orderStatusEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: [true, "A status event must name a status"],
    },

    // When the order entered this status. Defaults to now so a caller that
    // forgets it still gets an honest timestamp rather than null.
    at: {
      type: Date,
      default: Date.now,
    },

    // Who moved it. Null for the initial "order placed" entry, which belongs
    // to the customer rather than to an admin, and for the rare case of a
    // system-driven change.
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // "customer" or "admin", so the timeline can be read without a second
    // lookup when an admin has since been deleted.
    actorRole: {
      type: String,
      enum: ["customer", "admin", "system"],
      default: "system",
    },

    // Why, where it matters: a cancellation reason, or an admin note.
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Note cannot exceed 300 characters"],
    },
  },
  { _id: false, timestamps: false }
);

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

    /**
     * Every status this order has been in, oldest first.
     *
     * Defaults to an empty array rather than being pre-filled, so orders that
     * predate this field keep working and the UI can tell the difference
     * between "no history" and "history that has not been recorded yet". A
     * `pre("validate")` hook below seeds the opening entry for new orders.
     */
    statusHistory: {
      type: [orderStatusEventSchema],
      default: [],
    },

    /**
     * Every change to `paymentStatus`, oldest first.
     *
     * Kept apart from `statusHistory` because money and dispatch are different
     * conversations: an order can be delivered and still unpaid, and an order
     * can be cancelled and refunded without ever shipping. Same empty-by-
     * default rule as statusHistory — existing orders are not given invented
     * entries.
     */
    paymentHistory: {
      type: [paymentStatusEventSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * One order per clientOrderRef.
 *
 * The last line of defence for double submission: `createOrder` checks first
 * and returns the original, and if two identical requests ever slipped past
 * that check and raced, the second insert fails here rather than creating a
 * duplicate order.
 *
 * Partial rather than plain `sparse`, and the distinction matters. A sparse
 * unique index still treats an explicit `null` as an indexed value, so with a
 * default of null every order without a reference would collide with every
 * other one — which is exactly what happened before this was changed. A
 * partial index covering only documents where the field is actually a string
 * exempts them properly.
 */
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

/**
 * Seed the opening status-history entry on a new order.
 *
 * Only for a genuinely new order: the status a freshly created document starts
 * at. Orders that existed before this field existed must keep an empty history,
 * because inventing a backdated entry for them would be fabricating a record of
 * when something happened. The UI tells those two cases apart — an empty
 * history renders an inferred timeline and says so.
 *
 * Runs on "validate" rather than "save" so the entry is present on the
 * in-memory document too, and `Order.create` returns it already populated.
 */
orderSchema.pre("validate", function () {
  if (!this.isNew) return;

  if (!Array.isArray(this.statusHistory) || this.statusHistory.length === 0) {
    this.statusHistory = [
      {
        status: this.orderStatus || "pending",
        at: new Date(),
        // No actor: the order was placed by the customer through the
        // storefront and createOrder does not attribute it to an admin
        // account.
        by: null,
        actorRole: "customer",
        note: "Order placed",
      },
    ];
  }

  if (!Array.isArray(this.paymentHistory) || this.paymentHistory.length === 0) {
    this.paymentHistory = [
      {
        paymentStatus: this.paymentStatus || "pending",
        at: new Date(),
        by: null,
        actorRole: "customer",
        note: "Awaiting payment",
      },
    ];
  }
});

module.exports = mongoose.model("Order", orderSchema);
