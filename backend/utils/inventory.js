const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const AppError = require("./AppError");

/**
 * The only place stock is allowed to change.
 *
 * Every path — supplier deliveries, customer orders, order cancellations,
 * manual corrections — goes through applyStockChange, so every change leaves a
 * StockMovement row and Product.stock is always the running total of the
 * ledger. Nothing in the codebase does `$inc: { stock: ... }` directly.
 *
 * The update is a single atomic document operation that also refuses to go
 * below zero, so two simultaneous orders for the last unit cannot both
 * succeed: MongoDB applies each document update to exactly one document
 * atomically, and the second one no longer matches the filter.
 */

/**
 * Applies one stock change and records it.
 *
 * @param {object}   opts
 * @param {string}   opts.productId
 * @param {number}   opts.quantity       always positive; `direction` sets the sign
 * @param {1|-1}     opts.direction      1 to add stock, -1 to remove it
 * @param {string}   opts.type           STOCK_IN | SALE | SALE_CANCEL | MANUAL_ADJUSTMENT
 * @param {string}   opts.referenceType  purchase | order | manual
 * @param {*}        [opts.referenceId]  related Purchase/Order id, if any
 * @param {*}        [opts.performedBy]  admin User id, if any
 * @param {string}   [opts.reason]
 * @param {number}   [opts.unitCost]     for STOCK_IN
 * @param {*}        [opts.supplier]     for STOCK_IN
 * @param {string}   [opts.productName]  snapshot, read from the DB if omitted
 * @returns {Promise<{product: object, movement: object}>}
 */
const applyStockChange = async ({
  productId,
  quantity,
  direction,
  type,
  referenceType,
  referenceId = null,
  performedBy = null,
  reason = "",
  unitCost = null,
  supplier = null,
  productName,
}) => {
  const amount = Math.abs(Number(quantity) || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Stock quantity must be at least 1", 400);
  }

  if (direction !== 1 && direction !== -1) {
    throw new AppError("Stock direction must be 1 (add) or -1 (remove)", 400);
  }

  // For a removal, the filter is what prevents overselling. If another order
  // already claimed the stock, this product no longer matches and we bail.
  const filter =
    direction === -1
      ? { _id: productId, stock: { $gte: amount } }
      : { _id: productId };

  const update = { $inc: { stock: direction * amount } };

  const product = await Product.findOneAndUpdate(filter, update, { new: true });

  if (!product) {
    // Distinguish "no such product" from "not enough stock" — the first is a
    // bad id, the second is a real business situation the caller must handle.
    const exists = await Product.exists({ _id: productId });
    if (!exists) throw new AppError("Product not found", 404);

    throw new AppError(
      `Only ${product?.stock ?? 0} in stock — not enough to remove ${amount}`,
      409
    );
  }

  const movement = await StockMovement.create({
    product: product._id,
    productName: productName || product.name,
    quantity: amount,
    direction,
    type,
    previousStock: product.stock - direction * amount,
    newStock: product.stock,
    referenceType,
    referenceId,
    performedBy,
    reason,
    unitCost,
    supplier,
  });

  return { product, movement };
};

/**
 * Applies several stock changes together, undoing the ones already applied if
 * any single one fails.
 *
 * Used when receiving a purchase: a partial delivery would leave the shop
 * believing stock arrived that never did, which is worse than a clean failure.
 */
const applyStockChanges = async (changes, rollbackOnFailure = true) => {
  const applied = [];

  try {
    for (const change of changes) {
      // Sequential on purpose: these are deliberate, and the ledger reads
      // better as a clean sequence than interleaved.
      // eslint-disable-next-line no-await-in-loop
      applied.push(await applyStockChange(change));
    }

    return applied;
  } catch (error) {
    if (rollbackOnFailure) {
      // Undo in reverse, so each rollback is the exact inverse of what it undid.
      for (const { product, movement } of applied.reverse()) {
        // The movement row is removed rather than kept: it never really
        // happened, and leaving it would misreport the ledger. Genuine
        // corrections use reverseMovement() instead, which keeps the history.
        // eslint-disable-next-line no-await-in-loop
        await StockMovement.deleteOne({ _id: movement._id });

        // eslint-disable-next-line no-await-in-loop
        await Product.updateOne(
          { _id: product._id },
          { $inc: { stock: -movement.direction * movement.quantity } }
        );
      }
    }

    throw error;
  }
};

/**
 * Reverts one movement, recording the reversal rather than erasing it.
 *
 * Used for corrections an admin makes after the fact, where the original
 * movement did genuinely happen and the ledger should show both.
 */
const reverseMovement = async (movement, { performedBy = null, reason = "" } = {}) => {
  return applyStockChange({
    productId: movement.product,
    quantity: movement.quantity,
    // Flip the direction of the movement being undone.
    direction: movement.direction === 1 ? -1 : 1,
    type: "MANUAL_ADJUSTMENT",
    referenceType: "manual",
    // No referenceId, so the duplicate-movement index doesn't collide with
    // the movement being reversed.
    referenceId: null,
    performedBy,
    reason:
      reason ||
      `Reversal of ${movement.type.toLowerCase()} of ${movement.quantity} on ${new Date(
        movement.createdAt
      ).toISOString().slice(0, 10)}`,
  });
};

module.exports = {
  applyStockChange,
  applyStockChanges,
  reverseMovement,
};
