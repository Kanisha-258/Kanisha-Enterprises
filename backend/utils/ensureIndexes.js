const mongoose = require("mongoose");

// Every model, so their indexes get created on boot.
const MODELS = [
  require("../models/User"),
  require("../models/Product"),
  require("../models/Order"),
  require("../models/Review"),
  require("../models/Enquiry"),
  require("../models/Coupon"),
  require("../models/Blog"),
  require("../models/PasswordResetToken"),
];

/**
 * Builds the indexes declared in each schema.
 *
 * This matters more than it looks: `unique: true` in a Mongoose schema is
 * only a *declaration*. MongoDB does nothing with it until the index is
 * actually built, which Mongoose won't do on its own. Without this call,
 * duplicate emails, slugs and coupon codes would slip through silently on a
 * fresh database.
 *
 * Index creation is idempotent, so this is safe to run on every boot.
 */
const ensureIndexes = async () => {
  try {
    for (const Model of MODELS) {
      await Model.createIndexes();
    }
    console.log(`Indexes verified for ${MODELS.length} collections`);
  } catch (error) {
    // A missing unique index is worth knowing about, but it shouldn't stop
    // the server from coming up.
    console.error("⚠️  Could not build one or more indexes:", error.message);
  }
};

/**
 * Call once MongoDB is connected.
 * @param {number} retries how many times to wait for the connection
 */
const initDatabase = async (retries = 10) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const state = mongoose.connection.readyState;

    // 1 === connected
    if (state === 1) {
      await ensureIndexes();
      return true;
    }

    // 0 === disconnected, 2 === connecting
    if (attempt === retries) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
};

module.exports = initDatabase;
module.exports.ensureIndexes = ensureIndexes;
