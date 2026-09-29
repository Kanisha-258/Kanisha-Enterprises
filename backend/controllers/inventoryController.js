const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Purchase = require("../models/Purchase");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const { applyStockChange, reverseMovement } = require("../utils/inventory");
const { isObjectId, isNonEmptyString, toPage, toLimit } = require("../utils/validators");

// Below this, the inventory page flags a product for restocking. Matches the
// threshold the admin dashboard already uses, so the two never disagree.
const LOW_STOCK_THRESHOLD = 10;

// GET /api/admin/inventory   (protected + admin)
//
// Current stock for every product, plus enough context to act on it: what it
// last cost, when it last moved, and whether it is running low.
const getInventory = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};

  if (req.query.search) {
    const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { sku: rx }, { category: rx }];
  }

  if (req.query.category && req.query.category !== "all") {
    filter.category = req.query.category;
  }

  // "low" and "out" are the two states that need action, so they're
  // first-class filters rather than something the UI has to infer.
  if (req.query.stock === "low") {
    filter.stock = { $gt: 0, $lte: LOW_STOCK_THRESHOLD };
  } else if (req.query.stock === "out") {
    filter.stock = 0;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("name sku category unit stock price discountPrice isActive")
      .sort({ stock: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const productIds = products.map((p) => p._id);

  // Last movement per product, so the list can show "moved 2 days ago"
  // without an N+1 query per row.
  const lastMovements = await StockMovement.aggregate([
    { $match: { product: { $in: productIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$product",
        type: { $first: "$type" },
        quantity: { $first: "$quantity" },
        // direction is what tells the UI whether to render "+4" or "−4".
        // Without it a stock-in renders with the wrong sign.
        direction: { $first: "$direction" },
        createdAt: { $first: "$createdAt" },
        productName: { $first: "$productName" },
      },
    },
  ]);

  // Weighted average purchase cost per product.
  const costs = await Purchase.aggregate([
    { $match: { status: "received" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalCost: { $sum: "$items.lineTotal" },
        totalQty: { $sum: "$items.quantity" },
      },
    },
    {
      $project: {
        avgCost: {
          $cond: [
            { $gt: ["$totalQty", 0] },
            { $round: [{ $divide: ["$totalCost", "$totalQty"] }, 2] },
            null,
          ],
        },
      },
    },
  ]);

  const movementMap = new Map(lastMovements.map((m) => [String(m._id), m]));
  const costMap = new Map(costs.map((c) => [String(c._id), c.avgCost]));

  const inventory = products.map((p) => {
    const last = movementMap.get(String(p._id));
    const avgCost = costMap.get(String(p._id));

    return {
      ...p,
      lowStock: p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD,
      outOfStock: p.stock === 0,
      averageCost: avgCost ?? null,
      // Selling above what we paid, or below. null when we've never bought it.
      marginPercent:
        avgCost && avgCost > 0
          ? Math.round(
              (((p.discountPrice > 0 ? p.discountPrice : p.price) - avgCost) /
                avgCost) *
                100
            )
          : null,
      lastMovement: last
        ? { type: last.type, quantity: last.quantity, at: last.createdAt }
        : null,
    };
  });

  res.json({
    success: true,
    count: inventory.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    inventory,
  });
});

// GET /api/admin/inventory/summary   (protected + admin)
const getInventorySummary = asyncHandler(async (req, res) => {
  const [counts, movementTotals] = await Promise.all([
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalUnits: { $sum: "$stock" },
          outOfStock: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", LOW_STOCK_THRESHOLD] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    StockMovement.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: "$type", units: { $sum: "$quantity" }, count: { $sum: 1 } } },
    ]),
  ]);

  const row = counts?.[0] || {};

  // Stock value at the most recent average purchase cost, where we have one.
  const [value] = await Purchase.aggregate([
    { $match: { status: "received" } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product", cost: { $sum: "$items.lineTotal" }, qty: { $sum: "$items.quantity" } } },
    { $group: { _id: null, avgCost: { $sum: { $divide: ["$cost", "$qty"] } } } },
  ]);

  const movements = Object.fromEntries(movementTotals.map((m) => [m._id, m]));

  res.json({
    success: true,
    stats: {
      totalProducts: row.totalProducts || 0,
      totalUnits: row.totalUnits || 0,
      lowStock: row.lowStock || 0,
      outOfStock: row.outOfStock || 0,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      stockIn30d: movements.STOCK_IN?.units || 0,
      sold30d: movements.SALE?.units || 0,
      returned30d: movements.SALE_CANCEL?.units || 0,
      movementCount30d: movementTotals.reduce((sum, m) => sum + m.count, 0),
    },
  });
});

// GET /api/admin/inventory/movements   (protected + admin)
//
// The cross-product movement feed, filterable by type and product.
const getRecentMovements = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 30, 200);

  const filter = {};

  if (req.query.type && req.query.type !== "all") filter.type = req.query.type;
  if (req.query.product && isObjectId(req.query.product)) {
    filter.product = req.query.product;
  }
  if (req.query.referenceType && req.query.referenceType !== "all") {
    filter.referenceType = req.query.referenceType;
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate("supplier", "name companyName")
      .populate("performedBy", "name email")
      .populate("referenceId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: movements.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    movements,
  });
});

/**
 * GET /api/admin/inventory/:productId   (protected + admin)
 *
 * One product's full stock history, split into in and out so the inventory
 * page can show both sides at once.
 */
const getProductStockHistory = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.productId)) {
    throw new AppError("Invalid product id", 400);
  }

  const product = await Product.findById(req.params.productId)
    .select("name sku category unit stock price discountPrice isActive")
    .lean();

  if (!product) throw new AppError("Product not found", 404);

  const limit = toLimit(req.query.limit, 50, 200);

  const [movements, inTotals, outTotals] = await Promise.all([
    StockMovement.find({ product: product._id })
      .populate("supplier", "name companyName")
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    StockMovement.aggregate([
      { $match: { product: product._id, direction: 1 } },
      { $group: { _id: null, units: { $sum: "$quantity" } } },
    ]),
    StockMovement.aggregate([
      { $match: { product: product._id, direction: -1 } },
      { $group: { _id: null, units: { $sum: "$quantity" } } },
    ]),
  ]);

  const inList = movements.filter((m) => m.direction === 1);
  const outList = movements.filter((m) => m.direction === -1);

  res.json({
    success: true,
    product: {
      ...product,
      lowStock: product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD,
      outOfStock: product.stock === 0,
    },
    totalUnitsIn: inTotals?.[0]?.units || 0,
    totalUnitsOut: outTotals?.[0]?.units || 0,
    stockIn: inList,
    stockOut: outList,
    movements,
  });
});

/**
 * POST /api/admin/inventory/:productId/adjust   (protected + admin)
 *
 * A manual correction: damage, a recount, a data-entry mistake.
 *
 * A reason is mandatory. Without one, "stock was wrong" is unrecoverable
 * three months later, and the adjustment is the only record of the change.
 */
const adjustStock = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.productId)) {
    throw new AppError("Invalid product id", 400);
  }

  const { quantity, reason, direction } = req.body;

  // The admin picks "add" or "remove" explicitly. Guessing from a signed
  // number invites a sign error becoming an invisible stock gain.
  if (direction !== "add" && direction !== "remove") {
    throw new AppError('Choose whether to add or remove stock ("add" or "remove")', 400);
  }

  if (!isNonEmptyString(reason) || reason.trim().length < 5) {
    throw new AppError(
      "Please give a reason of at least 5 characters — this is the only record of why stock changed",
      400
    );
  }

  const amount = Number(quantity);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError("Quantity must be a whole number of at least 1", 400);
  }

  const { product, movement } = await applyStockChange({
    productId: req.params.productId,
    quantity: amount,
    direction: direction === "add" ? 1 : -1,
    type: "MANUAL_ADJUSTMENT",
    referenceType: "manual",
    referenceId: null,
    performedBy: req.user._id,
    reason: reason.trim(),
  });

  res.status(201).json({
    success: true,
    message: `Stock ${direction === "add" ? "increased" : "decreased"} by ${amount}`,
    product: {
      _id: product._id,
      name: product.name,
      stock: product.stock,
      unit: product.unit,
    },
    movement,
  });
});

module.exports = {
  getInventory,
  getInventorySummary,
  getRecentMovements,
  getProductStockHistory,
  adjustStock,
  LOW_STOCK_THRESHOLD,
};
