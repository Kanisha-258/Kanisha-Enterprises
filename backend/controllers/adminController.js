const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Enquiry = require("../models/Enquiry");
const Review = require("../models/Review");
const Coupon = require("../models/Coupon");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const { toPublicUser } = require("../utils/sanitize");
const { toPage, toLimit, isEmail } = require("../utils/validators");

// GET /api/admin/stats   (protected + admin) — dashboard summary
const getStats = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [
    totalRevenueAgg,
    last30RevenueAgg,
    orderCount,
    pendingOrders,
    productCount,
    lowStock,
    customerCount,
    newEnquiries,
    reviewCount,
    recentOrders,
    topProducts,
    statusCounts,
  ] = await Promise.all([
    // Cancelled orders don't count as revenue.
    Order.aggregate([
      { $match: { orderStatus: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $ne: "cancelled" }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: { $in: ["pending", "confirmed", "packed"] } }),
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
    User.countDocuments({ role: "user" }),
    Enquiry.countDocuments({ status: "new" }),
    Review.countDocuments(),
    Order.find()
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Order.aggregate([
      { $match: { orderStatus: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          image: { $first: "$items.image" },
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
  ]);

  // Compare the last 30 days against the 30 before it, for a simple trend.
  const [prev30RevenueAgg] = await Order.aggregate([
    { $match: { orderStatus: { $ne: "cancelled" }, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]);

  const last30 = last30RevenueAgg?.total || 0;
  const prev30 = prev30RevenueAgg?.total || 0;
  const revenueTrend = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null;

  res.json({
    success: true,
    stats: {
      totalRevenue: totalRevenueAgg?.[0]?.total || 0,
      revenueLast30Days: last30,
      revenueTrend,
      totalOrders: orderCount,
      pendingOrders,
      totalProducts: productCount,
      lowStockProducts: lowStock,
      totalCustomers: customerCount,
      newEnquiries,
      totalReviews: reviewCount,
    },
    statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    recentOrders,
    topProducts: topProducts.map((p) => ({ ...p, _id: p._id })),
  });
});

// --- Users ---

// GET /api/admin/users   (protected + admin)
const getUsers = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};
  if (req.query.search) {
    // Escaped so a stray "[" or "(" in the search box is matched literally
    // instead of producing an invalid regex and a 500.
    const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (req.query.role && req.query.role !== "all") filter.role = req.query.role;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: users.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    users: users.map(toPublicUser),
  });
});

// PUT /api/admin/users/:id   (protected + admin)
// Lets the shop activate/deactivate an account or promote someone to admin.
const updateUser = asyncHandler(async (req, res) => {
  const { isActive, role } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  // Guard against an admin locking themselves out.
  if (String(user._id) === String(req.user._id) && (isActive === false || (role && role !== "admin"))) {
    throw new AppError("You cannot remove your own admin access", 400);
  }

  if (isActive !== undefined) user.isActive = Boolean(isActive);
  if (role !== undefined) {
    if (!["user", "admin"].includes(role)) throw new AppError("Invalid role", 400);
    user.role = role;
  }

  await user.save();

  res.json({ success: true, message: "User updated", user: toPublicUser(user) });
});

// --- Coupons ---

// GET /api/admin/coupons   (protected + admin)
const getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json({ success: true, count: coupons.length, coupons });
});

// POST /api/admin/coupons   (protected + admin)
const createCoupon = asyncHandler(async (req, res) => {
  const { code, description, type, value, maxDiscount, minOrderValue, appliesTo, usageLimit, validUntil, isActive } = req.body;

  if (!code || !code.trim()) throw new AppError("Coupon code is required", 400);
  if (value === undefined || Number(value) <= 0) throw new AppError("Discount value must be greater than zero", 400);
  if (type === "percentage" && Number(value) > 100) throw new AppError("A percentage discount cannot exceed 100", 400);

  if (await Coupon.exists({ code: code.trim().toUpperCase() })) {
    throw new AppError("A coupon with this code already exists", 409);
  }

  const coupon = await Coupon.create({
    code: code.trim().toUpperCase(),
    description: description || "",
    type: type || "percentage",
    value: Number(value),
    maxDiscount: Number(maxDiscount) || 0,
    minOrderValue: Number(minOrderValue) || 0,
    appliesTo: Array.isArray(appliesTo) ? appliesTo : [],
    usageLimit: Number(usageLimit) || 0,
    validUntil: validUntil || null,
    isActive: isActive === undefined ? true : Boolean(isActive),
  });

  res.status(201).json({ success: true, message: "Coupon created", coupon });
});

// PUT /api/admin/coupons/:id   (protected + admin)
// Edit a coupon, or just switch it on/off. Deactivating is preferred over
// deleting, so a code that was used on past orders keeps its history.
const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) throw new AppError("Coupon not found", 404);

  const {
    description,
    type,
    value,
    maxDiscount,
    minOrderValue,
    appliesTo,
    usageLimit,
    validUntil,
    isActive,
  } = req.body;

  if (type !== undefined) {
    if (!["percentage", "flat"].includes(type)) {
      throw new AppError("Type must be 'percentage' or 'flat'", 400);
    }
    coupon.type = type;
  }

  if (value !== undefined) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new AppError("Discount value must be greater than zero", 400);
    }
    if (coupon.type === "percentage" && numeric > 100) {
      throw new AppError("A percentage discount cannot exceed 100", 400);
    }
    coupon.value = numeric;
  }

  if (description !== undefined) coupon.description = description;
  if (maxDiscount !== undefined) coupon.maxDiscount = Number(maxDiscount) || 0;
  if (minOrderValue !== undefined) coupon.minOrderValue = Number(minOrderValue) || 0;
  if (appliesTo !== undefined) coupon.appliesTo = Array.isArray(appliesTo) ? appliesTo : [];
  if (usageLimit !== undefined) coupon.usageLimit = Number(usageLimit) || 0;
  if (validUntil !== undefined) coupon.validUntil = validUntil || null;
  if (isActive !== undefined) coupon.isActive = Boolean(isActive);

  await coupon.save();

  res.json({ success: true, message: "Coupon updated", coupon });
});

// DELETE /api/admin/coupons/:id   (protected + admin)
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError("Coupon not found", 404);

  res.json({ success: true, message: "Coupon deleted" });
});

module.exports = {
  getStats,
  getUsers,
  updateUser,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
