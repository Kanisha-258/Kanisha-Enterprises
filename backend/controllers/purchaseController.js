const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const { applyStockChanges } = require("../utils/inventory");
const { isObjectId, isNonEmptyString, toPage, toLimit } = require("../utils/validators");

/**
 * Validates and prices the line items on a purchase.
 *
 * Cost prices and line totals are always computed here from the database
 * product list, never taken from the request. A purchase is a record of what
 * the shop paid, so a tampered body must not be able to invent a price.
 */
const readPurchaseItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AppError("A purchase must contain at least one item", 400);
  }

  const ids = rawItems.map((i) => i.product || i.productId);
  const uniqueIds = [...new Set(ids.map(String))];

  if (uniqueIds.length !== ids.length) {
    throw new AppError("The same product was added twice", 400);
  }

  if (uniqueIds.some((id) => !isObjectId(id))) {
    throw new AppError("One or more products are invalid", 400);
  }

  const products = await Product.find({ _id: { $in: uniqueIds } });

  if (products.length !== uniqueIds.length) {
    throw new AppError("One or more products could not be found", 400);
  }

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return rawItems.map((item) => {
    const product = productMap.get(String(item.product || item.productId));

    if (!product) throw new AppError("One or more products could not be found", 400);

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new AppError("Quantity must be a whole number of at least 1", 400);
    }

    const costPrice = Number(item.costPrice);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new AppError("Cost price must be zero or more", 400);
    }

    return {
      product: product._id,
      name: product.name,
      unit: product.unit,
      costPrice,
      quantity,
      lineTotal: Math.round(costPrice * quantity),
    };
  });
};

/** Subtotal, discount and total, computed once and stored on the document. */
const pricePurchase = (items, discount = 0) => {
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  // A discount can never exceed what the goods are worth.
  const applied = Math.max(0, Math.min(Math.round(Number(discount) || 0), subtotal));

  return { subtotal, discount: applied, total: subtotal - applied };
};

// GET /api/admin/purchases   (protected + admin)
const getPurchases = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};

  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.supplier && isObjectId(req.query.supplier)) {
    filter.supplier = req.query.supplier;
  }
  if (req.query.search) {
    const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    filter.$or = [{ purchaseNumber: rx }, { notes: rx }, { "items.name": rx }];
  }

  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .populate("supplier", "name companyName gstin")
      .populate("receivedBy", "name email")
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: purchases.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    purchases,
  });
});

// GET /api/admin/purchases/:id   (protected + admin)
const getPurchaseById = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid purchase id", 400);

  const purchase = await Purchase.findById(req.params.id)
    .populate("supplier", "name companyName phone gstin")
    .populate("receivedBy", "name email")
    .populate("items.product", "name slug stock unit");

  if (!purchase) throw new AppError("Purchase not found", 404);

  res.json({ success: true, purchase });
});

// POST /api/admin/purchases   (protected + admin)
//
// Creates a purchase as a draft. Stock is not touched here — that only happens
// when the purchase is explicitly received, so a half-typed order can't quietly
// inflate inventory.
const createPurchase = asyncHandler(async (req, res) => {
  const { supplier: supplierId, purchaseDate, notes } = req.body;

  if (!isObjectId(supplierId || "")) {
    throw new AppError("Choose a supplier", 400);
  }

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw new AppError("Supplier not found", 404);
  if (!supplier.isActive) {
    throw new AppError("That supplier is deactivated. Reactivate them first.", 400);
  }

  const items = await readPurchaseItems(req.body.items);
  const totals = pricePurchase(items, req.body.discount);

  const purchase = await Purchase.create({
    supplier: supplier._id,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    items,
    ...totals,
    notes: String(notes || "").trim(),
    status: "draft",
  });

  res.status(201).json({ success: true, message: "Purchase created", purchase });
});

// PUT /api/admin/purchases/:id   (protected + admin)
//
// Edits a draft. A received or cancelled purchase is immutable, because
// changing it would no longer match the stock movements it produced.
const updatePurchase = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid purchase id", 400);

  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw new AppError("Purchase not found", 404);

  if (purchase.status !== "draft") {
    throw new AppError(
      `A ${purchase.status} purchase can't be edited, because its stock has already been recorded. Cancel it and raise a new one instead.`,
      400
    );
  }

  if (req.body.supplier !== undefined) {
    if (!isObjectId(req.body.supplier)) throw new AppError("Choose a supplier", 400);

    const supplier = await Supplier.findById(req.body.supplier);
    if (!supplier) throw new AppError("Supplier not found", 404);
    if (!supplier.isActive) {
      throw new AppError("That supplier is deactivated. Reactivate them first.", 400);
    }

    purchase.supplier = supplier._id;
  }

  if (req.body.purchaseDate !== undefined) {
    const date = new Date(req.body.purchaseDate);
    if (Number.isNaN(date.getTime())) throw new AppError("Invalid purchase date", 400);
    purchase.purchaseDate = date;
  }

  if (req.body.notes !== undefined) purchase.notes = String(req.body.notes || "").trim();

  if (req.body.items !== undefined) {
    purchase.items = await readPurchaseItems(req.body.items);
  }

  // Always re-price from the lines, so the stored totals can never drift from
  // what the items actually say.
  Object.assign(purchase, pricePurchase(purchase.items, req.body.discount ?? purchase.discount));

  await purchase.save();

  res.json({ success: true, message: "Purchase updated", purchase });
});

/**
 * POST /api/admin/purchases/:id/receive   (protected + admin)
 *
 * The stock-in. Adds every line's quantity to the product, writes a
 * STOCK_IN movement for each, and marks the purchase received.
 *
 * Idempotent: a purchase that has already been received is rejected rather
 * than adding the stock twice, so a double click or a retried request is
 * harmless.
 */
const receivePurchase = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid purchase id", 400);

  const purchase = await Purchase.findById(req.params.id).populate(
    "supplier",
    "name gstin"
  );

  if (!purchase) throw new AppError("Purchase not found", 404);

  if (purchase.status === "cancelled") {
    throw new AppError("This purchase was cancelled and cannot be received", 400);
  }

  if (purchase.stockInApplied) {
    throw new AppError(
      "This purchase has already been received. Its stock was added once and cannot be added again.",
      409
    );
  }

  // Claim the purchase before touching stock. A conditional update means two
  // admins clicking "Receive" at the same moment cannot both get past this
  // point — the second update won't match, because the first already set the
  // flag.
  const claimed = await Purchase.findOneAndUpdate(
    { _id: purchase._id, stockInApplied: false },
    { $set: { stockInApplied: true, receivedAt: new Date(), receivedBy: req.user._id } },
    { new: true }
  );

  if (!claimed) {
    throw new AppError("This purchase has already been received", 409);
  }

  try {
    await applyStockChanges(
      claimed.items.map((item) => ({
        productId: item.product,
        productName: item.name,
        quantity: item.quantity,
        direction: 1,
        type: "STOCK_IN",
        referenceType: "purchase",
        referenceId: claimed._id,
        performedBy: req.user._id,
        unitCost: item.costPrice,
        supplier: purchase.supplier._id,
        reason: `Goods received from ${purchase.supplier.name} (${purchase.purchaseNumber})`,
      }))
    );
  } catch (error) {
    // Release the claim so the admin can retry, and surface the real problem.
    await Purchase.updateOne(
      { _id: claimed._id },
      { $set: { stockInApplied: false, receivedAt: null, receivedBy: null } }
    );

    throw error;
  }

  // Update the already-claimed document rather than saving the stale `purchase`
  // read at the top. Saving the stale copy would write back its unchanged
  // `stockInApplied: false`, silently undoing the claim and letting a second
  // receive double the stock.
  claimed.status = "received";
  await claimed.save();

  res.json({
    success: true,
    message: `Stock added for ${claimed.items.length} product(s)`,
    purchase: claimed,
  });
});

/**
 * PUT /api/admin/purchases/:id/cancel   (protected + admin)
 *
 * Cancels a purchase and returns any stock it had added, as recorded
 * SALE_CANCEL-style movements so the ledger still balances.
 */
const cancelPurchase = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid purchase id", 400);

  const purchase = await Purchase.findById(req.params.id).populate("supplier", "name");
  if (!purchase) throw new AppError("Purchase not found", 404);

  if (purchase.status === "cancelled") {
    throw new AppError("This purchase is already cancelled", 400);
  }

  const reason = String(req.body?.reason || "").trim() || "Purchase cancelled by the shop";

  if (purchase.stockInApplied) {
    // Return the exact quantities that came in, not a recomputation, so a
    // mismatch can never quietly change stock.
    await applyStockChanges(
      purchase.items.map((item) => ({
        productId: item.product,
        productName: item.name,
        quantity: item.quantity,
        direction: -1,
        type: "MANUAL_ADJUSTMENT",
        referenceType: "purchase",
        referenceId: purchase._id,
        performedBy: req.user._id,
        reason: `Cancelled ${purchase.purchaseNumber}: ${reason}`,
      }))
    );
  }

  purchase.status = "cancelled";
  purchase.cancelledAt = new Date();
  purchase.stockInApplied = false;
  purchase.notes = purchase.notes
    ? `${purchase.notes}\n\nCancelled: ${reason}`
    : `Cancelled: ${reason}`;

  await purchase.save();

  res.json({ success: true, message: "Purchase cancelled", purchase });
});

// DELETE /api/admin/purchases/:id   (protected + admin)
//
// Only drafts can be deleted. Anything received has real stock behind it and
// must be cancelled instead, so the movement history stays honest.
const deletePurchase = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid purchase id", 400);

  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw new AppError("Purchase not found", 404);

  if (purchase.stockInApplied) {
    throw new AppError(
      "This purchase has already added stock. Cancel it instead of deleting it, so the stock history stays accurate.",
      409
    );
  }

  await purchase.deleteOne();

  res.json({ success: true, message: "Draft purchase deleted" });
});

/** Summary figures for the purchases summary bar. */
const getPurchaseSummary = asyncHandler(async (req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totals, thisMonth, supplierCount] = await Promise.all([
    Purchase.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          spend: { $sum: "$total" },
          count: { $sum: 1 },
          units: { $sum: { $sum: "$items.quantity" } },
        },
      },
    ]),
    Purchase.aggregate([
      { $match: { status: { $ne: "cancelled" }, purchaseDate: { $gte: monthStart } } },
      { $group: { _id: null, spend: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Supplier.countDocuments({ isActive: true }),
  ]);

  res.json({
    success: true,
    stats: {
      totalSpend: totals?.[0]?.spend || 0,
      totalPurchases: totals?.[0]?.count || 0,
      totalUnits: totals?.[0]?.units || 0,
      monthSpend: thisMonth?.[0]?.spend || 0,
      monthPurchases: thisMonth?.[0]?.count || 0,
      activeSuppliers: supplierCount,
    },
  });
});

module.exports = {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  receivePurchase,
  cancelPurchase,
  deletePurchase,
  getPurchaseSummary,
  readPurchaseItems,
  pricePurchase,
};
