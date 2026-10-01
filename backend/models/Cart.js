const mongoose = require("mongoose");

/**
 * One line in a saved cart: which product, and how many.
 *
 * Deliberately no price, name or image. A cart is a *wish list of things*, not
 * a quote — every figure that affects money is read from the Product and Order
 * side at the moment it is needed. If a cart cached prices, a cart left open
 * for a week would happily show last week's price for something that has since
 * been repriced, and the customer would be surprised at checkout.
 */
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "A cart item must name a product"],
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      // Whole units only. A fractional bag of seed is not a thing we sell, and
      // allowing it here would produce totals the shop can't actually fulfil.
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
  },
  {
    // No per-item timestamps: the cart as a whole is what matters, and the
    // document's own updatedAt already says when it last changed.
    timestamps: false,
    _id: false,
  }
);

/**
 * A saved cart, so a signed-in customer's basket survives a closed tab, a
 * changed phone, or a different browser.
 *
 * The browser copy in localStorage is still the immediate read path — the cart
 * page must render instantly and must keep working with no connection, which
 * matters for the patchy mobile networks this site's customers use. This
 * document is the durable copy that the local one syncs with.
 *
 * Exactly one cart per user: `user` is unique, so a second sign-in on another
 * device continues the same basket rather than starting a fresh one.
 */
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A cart must belong to a user"],
      // Unique rather than merely indexed: two documents for one user would
      // make "which cart is the cart?" ambiguous on every read.
      unique: true,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
      // A cart is not allowed to be an empty array, because an empty cart is
      // better represented by the document not existing at all — that keeps
      // the collection from filling up with one empty doc per user who ever
      // cleared their basket.
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "A saved cart must contain at least one item",
      },
    },
  },
  {
    timestamps: true,
  }
);

// A product may appear at most once in a cart. The controller merges repeats
// rather than relying on this, but the index makes a duplicate a hard error
// rather than a silent double-count if that ever changes.
cartSchema.index({ user: 1, "items.product": 1 });

module.exports = mongoose.model("Cart", cartSchema);
