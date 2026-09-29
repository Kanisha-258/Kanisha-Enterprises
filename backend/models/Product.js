const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [160, "Product name cannot exceed 160 characters"],
    },

    // Short URL-friendly identifier, generated from the name.
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    sku: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },

    // Optional. Empty string if the product doesn't belong to a subcategory.
    subcategory: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Longer copy shown on the product detail page.
    details: {
      type: String,
      default: "",
    },

    // How to use / application notes.
    usage: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    discountPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      default: "",
    },

    brand: {
      type: String,
      default: "",
      trim: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    // Average rating, recomputed automatically from the Review collection.
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    image: {
      type: String,
      required: [true, "Product image is required"],
    },

    // Extra images for the detail-page gallery.
    gallery: {
      type: [String],
      default: [],
    },

    // Highlights shown as a bulleted list on the product page.
    highlights: {
      type: [String],
      default: [],
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    // Lets the products page do server-side search + filtering.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text index powering the search bar.
productSchema.index({ name: "text", description: "text", brand: "text" });

/**
 * Adds a numeric suffix until `field` is unused, e.g. "SEE-1234" -> "SEE-1234-2".
 * Used for both slug and SKU, which are unique in the database.
 */
const findUnique = async (Model, field, base, excludeId) => {
  const filter = excludeId ? { _id: { $ne: excludeId } } : {};

  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-await-in-loop
  while (await Model.exists({ ...filter, [field]: candidate })) {
    candidate = `${base}-${++suffix}`;
  }

  return candidate;
};

// Auto-generate a unique slug + SKU when they aren't supplied.
// This is an async hook because uniqueness must be checked against the
// database: two products can legitimately share a name — "Tomato Seeds" and
// "Tomato Seeds (Hybrid A)" both need a distinct URL and SKU.
productSchema.pre("validate", async function () {
  if (!this.name) return;

  if (!this.sku) {
    const prefix = (this.category || "KE")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase();

    // A random component avoids collisions when many products are inserted
    // in the same millisecond (insertMany validates them in one tick, so
    // Date.now() alone would repeat).
    const stamp = Date.now().toString(36).slice(-4).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();

    this.sku = await findUnique(
      mongoose.models.Product,
      "sku",
      `${prefix}-${stamp}${rand}`,
      this._id
    );
  }

  if (this.slug) return; // explicitly supplied — respect it

  const base =
    this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `product-${Date.now()}`;

  this.slug = await findUnique(
    mongoose.models.Product,
    "slug",
    base,
    this._id
  );
});

// The price a customer actually pays.
productSchema.virtual("effectivePrice").get(function () {
  if (this.discountPrice > 0 && this.discountPrice < this.price) {
    return this.discountPrice;
  }
  return this.price;
});

productSchema.virtual("discountPercent").get(function () {
  if (!this.price || this.discountPrice <= 0 || this.discountPrice >= this.price) {
    return 0;
  }
  return Math.round(((this.price - this.discountPrice) / this.price) * 100);
});

module.exports = mongoose.model("Product", productSchema);
