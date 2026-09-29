const mongoose = require("mongoose");

/**
 * One row per password-reset request.
 *
 * A separate collection (rather than a field on User) means the reset token
 * can never be serialised by toPublicUser() and leaked through GET /auth/me,
 * and MongoDB's TTL index can expire rows automatically.
 *
 * Only the SHA-256 hash of the token is stored. A database leak therefore does
 * not hand an attacker usable reset links.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // sha256 hex digest of the token that was emailed out.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    // Set the moment the token is redeemed, so it can never be reused.
    usedAt: {
      type: Date,
      default: null,
    },

    // Rough origin for auditing, e.g. "request" or "password-change".
    source: {
      type: String,
      default: "request",
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB deletes the document once expiresAt passes — no cleanup job needed.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// A user can only have one live request at a time.
passwordResetTokenSchema.index({ user: 1, usedAt: 1 });

module.exports = mongoose.model("PasswordResetToken", passwordResetTokenSchema);
