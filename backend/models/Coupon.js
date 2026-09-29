const mongoose = require("mongoose");

// Optional discount codes, e.g. "HARVEST10" for 10% off.
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    type: {
      type: String,
      enum: ["percentage", "flat"],
      default: "percentage",
    },

    value: {
      type: Number,
      required: true,
      min: 0,
    },

    // Percentage coupons can have a cap, e.g. max ₹200 off on 20%.
    maxDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Blank = valid for every product.
    appliesTo: {
      type: [String],
      default: [],
    },

    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    validFrom: {
      type: Date,
      default: Date.now,
    },

    validUntil: {
      type: Date,
      default: null, // null = no expiry
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Coupon", couponSchema);
