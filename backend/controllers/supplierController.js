const Supplier = require("../models/Supplier");
const Purchase = require("../models/Purchase");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const { isEmail, isPhone, isObjectId, toPage, toLimit } = require("../utils/validators");

/**
 * Normalises the fields a supplier form can send.
 *
 * Whitespace-only strings become empty/null so "GSTIN left blank" is stored
 * as genuinely absent rather than as "   ", which is what makes the sparse
 * unique index on gstin work.
 */
const readSupplierBody = (body = {}, { partial = false } = {}) => {
  const data = {};

  const set = (key, value) => {
    if (value !== undefined) data[key] = value;
  };

  // Required on create, optional on edit.
  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? "").trim();
    if (!partial && !name) throw new AppError("Supplier name is required", 400);
    set("name", name);
  }

  if (body.companyName !== undefined) {
    set("companyName", String(body.companyName ?? "").trim());
  }

  if (body.phone !== undefined) {
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    if (phone && !isPhone(phone)) {
      throw new AppError("Phone number must be exactly 10 digits", 400);
    }
    set("phone", phone);
  }

  if (body.email !== undefined) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email && !isEmail(email)) {
      throw new AppError("Please enter a valid email address", 400);
    }
    set("email", email);
  }

  if (body.address !== undefined) {
    set("address", String(body.address ?? "").trim());
  }
  if (body.city !== undefined) set("city", String(body.city ?? "").trim());
  if (body.state !== undefined) set("state", String(body.state ?? "").trim());

  if (body.gstin !== undefined) {
    // Empty means "not registered", which must be null for the sparse index.
    const gstin = String(body.gstin ?? "").trim().toUpperCase();
    set("gstin", gstin || null);
  }

  if (body.notes !== undefined) {
    set("notes", String(body.notes ?? "").trim());
  }

  if (body.isActive !== undefined) {
    set("isActive", Boolean(body.isActive));
  }

  return data;
};

/** Turns Mongo's duplicate-key error into something a shopkeeper can act on. */
const assertNoDuplicateGstin = async (gstin, excludeId) => {
  if (!gstin) return;

  const filter = { gstin };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Supplier.exists(filter)) {
    throw new AppError("Another supplier already uses this GSTIN", 409);
  }
};

// GET /api/admin/suppliers   (protected + admin)
const getSuppliers = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};

  if (req.query.search) {
    // Escaped so a stray "[" in the search box is literal text, not a regex
    // that throws and returns a 500.
    const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { companyName: rx }, { phone: rx }, { gstin: rx }, { city: rx }];
  }

  if (req.query.isActive && req.query.isActive !== "all") {
    filter.isActive = req.query.isActive === "true";
  }

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Supplier.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: suppliers.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    suppliers,
  });
});

// GET /api/admin/suppliers/:id   (protected + admin)
const getSupplierById = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid supplier id", 400);

  const supplier = await Supplier.findById(req.params.id).lean();
  if (!supplier) throw new AppError("Supplier not found", 404);

  // Purchase history is what makes a supplier record useful, so it travels
  // with the detail view rather than needing a second call.
  const purchases = await Purchase.find({ supplier: supplier._id })
    .select("purchaseNumber purchaseDate total status items")
    .sort({ purchaseDate: -1 })
    .limit(20)
    .lean();

  const [totals] = await Purchase.aggregate([
    { $match: { supplier: supplier._id, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: null,
        totalSpend: { $sum: "$total" },
        purchaseCount: { $sum: 1 },
        unitsBought: { $sum: { $sum: "$items.quantity" } },
      },
    },
  ]);

  res.json({
    success: true,
    supplier,
    stats: {
      totalSpend: totals?.totalSpend || 0,
      purchaseCount: totals?.purchaseCount || 0,
      unitsBought: totals?.unitsBought || 0,
    },
    purchases,
  });
});

// POST /api/admin/suppliers   (protected + admin)
const createSupplier = asyncHandler(async (req, res) => {
  const data = readSupplierBody(req.body);

  await assertNoDuplicateGstin(data.gstin);

  const supplier = await Supplier.create(data);

  res.status(201).json({ success: true, message: "Supplier created", supplier });
});

// PUT /api/admin/suppliers/:id   (protected + admin)
const updateSupplier = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid supplier id", 400);

  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError("Supplier not found", 404);

  const data = readSupplierBody(req.body, { partial: true });

  await assertNoDuplicateGstin(data.gstin, supplier._id);

  Object.assign(supplier, data);
  await supplier.save();

  res.json({ success: true, message: "Supplier updated", supplier });
});

// DELETE /api/admin/suppliers/:id   (protected + admin)
//
// Soft delete by default. A hard delete would orphan the supplier reference on
// every past purchase and quietly rewrite history, so it needs an explicit
// opt-in and a clear warning.
const deleteSupplier = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError("Invalid supplier id", 400);

  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new AppError("Supplier not found", 404);

  const purchaseCount = await Purchase.countDocuments({ supplier: supplier._id });

  if (req.query.hard === "true") {
    if (purchaseCount > 0) {
      throw new AppError(
        `This supplier has ${purchaseCount} purchase(s) recorded against it. Deactivate it instead of deleting, so the history stays intact.`,
        409
      );
    }

    await supplier.deleteOne();
    return res.json({ success: true, message: "Supplier deleted" });
  }

  supplier.isActive = false;
  await supplier.save();

  res.json({
    success: true,
    message:
      purchaseCount > 0
        ? `Supplier deactivated. Their ${purchaseCount} past purchase(s) are kept.`
        : "Supplier deactivated",
    supplier,
  });
});

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
