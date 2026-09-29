const mongoose = require("mongoose");

/**
 * One line on a purchase.
 *
 * References the real Product instead of duplicating it, but snapshots the
 * name, unit and cost price. That mirrors Order's approach: the catalogue can
 * be renamed or repriced later without making a year-old purchase look wrong.
 */
const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Each purchase line needs a product"],
    },
    name: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      default: "",
    },
    // What the shop pays the supplier, per unit. Never shown to customers.
    costPrice: {
      type: Number,
      required: [true, "Cost price is required for every purchase line"],
      min: [0, "Cost price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    // quantity * costPrice, fixed at the time the purchase was saved so a
    // later edit to the item can't silently change the recorded total.
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const purchaseSchema = new mongoose.Schema(
  {
    // Human-friendly reference, e.g. "PUR-7K2M9Q".
    purchaseNumber: {
      type: String,
      unique: true,
      index: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "A purchase must name a supplier"],
      index: true,
    },

    // When the goods were actually received, which may differ from when the
    // purchase was keyed in.
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "A purchase must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    // A discount the supplier agreed, off the whole purchase. 0 = none.
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Convenience roll-up so the shop doesn't have to add up lines to read a
    // purchase. Always derived; never trusted from the request body.
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    // draft        recorded, stock not yet added
    // received     goods are in, stock has been added
    // cancelled    voided; any stock it added is returned
    status: {
      type: String,
      enum: ["draft", "received", "cancelled"],
      default: "draft",
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    // --- Stock-in bookkeeping ---

    // Set the moment stock is added, and used to block a second stock-in if
    // "Receive goods" is somehow triggered twice (double click, retried
    // request, two admins at once).
    receivedAt: {
      type: Date,
      default: null,
    },

    // Who received it, for the audit trail.
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Stock added when received, and stock given back if later cancelled.
    // Kept so a reversal is an exact inverse rather than a recomputation.
    stockInApplied: {
      type: Boolean,
      default: false,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Weighted average cost, from every received (not cancelled) purchase.
 *
 * Lets the inventory page show what the shop currently pays for a product
 * without storing a second, drifting cost field on Product.
 */
purchaseSchema.statics.averageCostFor = async function averageCostFor(productId) {
  const [row] = await this.aggregate([
    { $match: { "items.product": new mongoose.Types.ObjectId(String(productId)), status: "received" } },
    { $unwind: "$items" },
    { $match: { "items.product": new mongoose.Types.ObjectId(String(productId)) } },
    {
      $group: {
        _id: null,
        totalCost: { $sum: "$items.lineTotal" },
        totalQty: { $sum: "$items.quantity" },
      },
    },
  ]);

  if (!row || row.totalQty === 0) return null;
  return Math.round((row.totalCost / row.totalQty) * 100) / 100;
};

// Auto-generate a purchase number like "PUR-7K2M9Q".
purchaseSchema.pre("validate", async function () {
  if (this.purchaseNumber) return;

  let candidate;
  do {
    candidate =
      "PUR-" +
      Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 6).toUpperCase();
  } while (await mongoose.models.Purchase.exists({ purchaseNumber: candidate }));

  this.purchaseNumber = candidate;
});

module.exports = mongoose.model("Purchase", purchaseSchema);
