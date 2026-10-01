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
  require("../models/Supplier"),
  require("../models/Purchase"),
  require("../models/StockMovement"),
  require("../models/Cart"),
];

/**
 * One-off index repairs, keyed by the exact index they replace.
 *
 * `createIndexes` will not change an existing index's options — MongoDB keeps
 * the original and Mongoose errors out on the name clash. So when a unique
 * index is corrected, the old one has to be dropped explicitly or the
 * correction silently never takes effect.
 *
 * Each entry is removed once it has been applied, so this does not run forever
 * and the migrations stay visible in the history rather than accumulating.
 */
const INDEX_MIGRATIONS = [
  {
    collection: "orders",
    name: "clientOrderRef_1",
    why:
      "was sparse, which still indexes an explicit null. Every order with no " +
      "client reference collided with every other one. Replaced by a partial " +
      "index covering only documents where the field is a string.",
  },
];

/** Drops superseded indexes so the corrected definitions can be built. */
const applyIndexMigrations = async () => {
  const db = mongoose.connection.db;
  if (!db) return;

  for (const migration of INDEX_MIGRATIONS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await db
      .collection(migration.collection)
      .indexes()
      .catch(() => []);

    const match = existing.find((i) => i.name === migration.name);

    if (!match) continue;

    // eslint-disable-next-line no-await-in-loop
    await db.collection(migration.collection).dropIndex(migration.name);
    console.log(`Rebuilt index ${migration.collection}.${migration.name} — ${migration.why}`);
  }
};

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
    await applyIndexMigrations();

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
