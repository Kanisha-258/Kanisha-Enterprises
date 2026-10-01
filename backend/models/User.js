const mongoose = require("mongoose");

// A reusable sub-schema so a user can save multiple delivery addresses.
const addressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: "Home",
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    line1: {
      type: String,
      trim: true,
    },
    line2: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[0-9]{10}$/, "Phone number must be 10 digits"],
    },

    // Always stored as a bcrypt hash. Never returned by any controller.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // hidden unless explicitly asked for with .select("+password")
    },

    // Whether this person works for the shop. This is the only field that
    // grants privilege, and it is never read from a request body.
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // What kind of buyer this is. Deliberately separate from `role`: a dealer
    // buys in bulk and may be offered dealer rates, but a dealer is still a
    // customer, not staff. Keeping the two apart means adminMiddleware only
    // ever has to look at `role`, so a dealer can never inherit admin access
    // by accident.
    //
    // Defaults to "customer", so every account that already exists keeps
    // working and no migration is required.
    userType: {
      type: String,
      enum: ["customer", "dealer"],
      default: "customer",
    },

    // Default address, mirrored from registration for quick checkout.
    address: {
      type: String,
      default: "",
      trim: true,
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
    pincode: {
      type: String,
      default: "",
      trim: true,
    },

    // Saved address book used at checkout.
    addresses: {
      type: [addressSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
