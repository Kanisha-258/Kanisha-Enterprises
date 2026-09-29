const mongoose = require("mongoose");

/**
 * An immutable record of one change to one product's stock.
 *
 * Every stock movement in the system writes a row here: goods received from a
 * supplier, an order deducting stock, a cancellation returning it, and manual
 * corrections. `Product.stock` is only ever the running total of these rows.
 *
 * Rows are never edited or deleted. A mistake is corrected by adding a
 * compensating MANUAL_ADJUSTMENT, so the history explains how the number got
 * to where it is.
 */
const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "A stock movement must name a product"],
      index: true,
    },

    // Name snapshot, so a ledger is still readable if the product is renamed
    // or later removed from the catalogue.
    productName: {
      type: String,
      default: "",
    },

    // Always positive. The direction comes from `direction`, never from the
    // sign of the number. Mixing the two is how ledgers become unreadable.
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },

    // 1 = stock went up, -1 = stock went down.
    //
    // Stored rather than derived from `type`, because MANUAL_ADJUSTMENT can
    // move stock either way. Without this, reversing or rolling back a
    // movement would have to guess which way it went.
    direction: {
      type: Number,
      enum: [1, -1],
      required: true,
    },

    type: {
      type: String,
      enum: ["STOCK_IN", "SALE", "SALE_CANCEL", "MANUAL_ADJUSTMENT"],
      required: [true, "Movement type is required"],
      index: true,
    },

    // Stock before and after, so a reader can verify the arithmetic without
    // replaying every earlier row.
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },

    // What caused this movement: "purchase", "order" or "manual".
    referenceType: {
      type: String,
      enum: ["purchase", "order", "manual"],
      required: [true, "Reference type is required"],
      index: true,
    },

    // The related Purchase or Order id, when there is one.
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // The admin who made the change. Populated for manual adjustments and
    // stock-in; the placing customer is not an admin and is not stored here.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Free-text explanation. Mandatory for MANUAL_ADJUSTMENT, where there is
    // no document to point at and the reason is the only record of intent.
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },

    // Unit cost at the time of the movement, for STOCK_IN only. Lets the
    // inventory page show what a delivery cost without re-deriving it.
    unitCost: {
      type: Number,
      default: null,
      min: 0,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

/**
 * Guards against the one thing that would corrupt the ledger: recording the
 * same movement twice.
 *
 * A unique index on (product, type, referenceId) is only meaningful when
 * referenceId exists, so it is sparse — manual adjustments (referenceId null)
 * are exempt and can repeat freely.
 */
stockMovementSchema.index(
  { product: 1, type: 1, referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: "objectId" } } }
);

// The inventory page reads a product's movements newest-first.
stockMovementSchema.index({ product: 1, createdAt: -1 });

// The "recent movements" feed filters by type and time across all products.
stockMovementSchema.index({ createdAt: -1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);
