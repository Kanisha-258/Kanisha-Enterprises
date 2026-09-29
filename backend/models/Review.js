const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Denormalised so we can show "Priya M." without a second query.
    userName: {
      type: String,
      required: true,
    },

    rating: {
      type: Number,
      required: [true, "A rating is required"],
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Review cannot exceed 1000 characters"],
    },

    isApproved: {
      type: Boolean,
      default: true, // publish immediately; admin can hide later
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per product.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// After any change, recompute the average rating + count on the product.
reviewSchema.statics.syncProductRating = async function (productId) {
  const stats = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
    {
      $group: {
        _id: "$product",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const Product = mongoose.model("Product");

  if (stats.length === 0) {
    await Product.findByIdAndUpdate(productId, { rating: 0, numReviews: 0 });
    return;
  }

  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(stats[0].average * 10) / 10,
    numReviews: stats[0].count,
  });
};

module.exports = mongoose.model("Review", reviewSchema);
