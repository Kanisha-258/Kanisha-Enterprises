const mongoose = require("mongoose");

/**
 * A business that supplies the shop with stock.
 *
 * Deliberately kept to contact and tax-identity fields only. Anything that
 * varies per delivery (price, quantity, what was ordered) belongs on a
 * Purchase, not here — see models/Purchase.js.
 */
const supplierSchema = new mongoose.Schema(
  {
    // The person we deal with. Required, because every other field is
    // optional and this is the one thing that makes a supplier identifiable.
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      maxlength: [120, "Supplier name cannot exceed 120 characters"],
    },

    // Registered business name, if different from the contact name.
    companyName: {
      type: String,
      default: "",
      trim: true,
      maxlength: [160, "Company name cannot exceed 160 characters"],
    },

    // Indian mobile numbers are 10 digits, matching User.phone and the
    // checkout address validation, so one validator covers all three.
    phone: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: (v) => v === "" || /^[0-9]{10}$/.test(v),
        message: "Phone number must be exactly 10 digits",
      },
    },

    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => v === "" || /^\S+@\S+\.\S+$/.test(v),
        message: "Please enter a valid email address",
      },
    },

    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Address cannot exceed 300 characters"],
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    state: {
      type: String,
      default: "",
      trim: true,
    },

    // 15 characters: 2 state digits, 10 PAN, 1 entity digit, 1 check letter.
    // Optional, because not every supplier is registered and many small
    // agricultural dealers are not.
    //
    // Null rather than "" for "no GSTIN" so the sparse unique index below can
    // tell "absent" apart from "present but empty".
    gstin: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: {
        validator: (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(v),
        message: "GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5",
      },
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    // Deactivated rather than deleted, so past purchases keep a valid
    // supplier to point at.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Powers the admin supplier search box.
supplierSchema.index({ name: "text", companyName: "text", city: "text", gstin: "text" });

/**
 * GSTIN identifies a supplier uniquely, and must never be claimed twice.
 *
 * The partial filter exists because `sparse` isn't enough. `sparse` only skips
 * documents where the field is *absent*; our suppliers all store an explicit
 * `null` for "not registered", and null is a value the index records — so the
 * second supplier without a GSTIN would collide with the first.
 *
 * `$type: "string"` alone is enough: the controller normalises a blank GSTIN to
 * null before saving, so any string here is a real one. `$ne` can't be combined
 * with `$type` in a partial index (Mongo rejects `$not`), which is why the
 * normalisation in supplierController matters.
 */
supplierSchema.index(
  { gstin: 1 },
  {
    unique: true,
    partialFilterExpression: { gstin: { $type: "string" } },
  }
);

module.exports = mongoose.model("Supplier", supplierSchema);
