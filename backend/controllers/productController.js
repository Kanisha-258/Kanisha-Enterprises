const Product = require("../models/Product");
const Review = require("../models/Review");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const {
  toPage,
  toLimit,
  toPositiveInt,
  isObjectId,
  isNonEmptyString,
} = require("../utils/validators");

// GET /api/products
// Query: ?category=&subcategory=&search=&sort=&page=&limit=&minPrice=&maxPrice=&inStock=&featured=
const getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    subcategory,
    search,
    sort,
    minPrice,
    maxPrice,
    inStock,
    featured,
  } = req.query;

  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 12, 60);

  const filter = { isActive: true };

  if (category && category !== "All") {
    filter.category = escapeRegex(category);
  }
  if (subcategory && subcategory !== "All") {
    filter.subcategory = escapeRegex(subcategory);
  }
  if (search) {
    // Escaped so user input can't produce an invalid or catastrophic regex.
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { description: rx }, { brand: rx }, { tags: rx }];
  }
  if (featured === "true") {
    filter.isFeatured = true;
  }
  if (inStock === "true") {
    filter.stock = { $gt: 0 };
  }

  // Filter on the price the customer actually pays (discountPrice when it
  // applies, otherwise the list price).
  if (minPrice || maxPrice) {
    const paid = {
      $cond: [
        { $and: [{ $gt: ["$discountPrice", 0] }, { $lt: ["$discountPrice", "$price"] }] },
        "$discountPrice",
        "$price",
      ],
    };

    const bounds = [];
    if (minPrice) bounds.push({ $gte: [paid, Number(minPrice)] });
    if (maxPrice) bounds.push({ $lte: [paid, Number(maxPrice)] });

    filter.$expr = { $and: bounds };
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating: { rating: -1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.newest;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: products.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    products,
  });
});

// GET /api/products/categories — drives the category/subcategory filter UI
const getCategories = asyncHandler(async (req, res) => {
  const rows = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$category",
        subcategories: { $addToSet: "$subcategory" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const categories = rows
    .map((row) => ({
      name: row._id,
      count: row.count,
      subcategories: row.subcategories.filter(Boolean).sort(),
    }))
    .filter((c) => c.name);

  res.json({ success: true, count: categories.length, categories });
});

// GET /api/products/:idOrSlug — works with either an ObjectId or a slug
const getProductById = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;

  const query = isObjectId(idOrSlug)
    ? { _id: idOrSlug, isActive: true }
    : { slug: idOrSlug.toLowerCase(), isActive: true };

  const product = await Product.findOne(query);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const [reviews, related] = await Promise.all([
    Review.find({ product: product._id, isApproved: true })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(20),
    Product.find({
      _id: { $ne: product._id },
      isActive: true,
      category: product.category,
    })
      .sort({ rating: -1 })
      .limit(4),
  ]);

  res.json({ success: true, product, reviews, related });
});

// --- Admin CRUD ---

// GET /api/products/admin/all (protected + admin) — includes inactive products
const getAdminProducts = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);
  const { search, category } = req.query;

  const filter = {};
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { sku: rx }, { brand: rx }];
  }
  if (category && category !== "All") filter.category = escapeRegex(category);

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: products.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    products,
  });
});

// POST /api/products (protected + admin)
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    category,
    subcategory,
    description,
    details,
    usage,
    price,
    discountPrice,
    unit,
    brand,
    stock,
    image,
    gallery,
    highlights,
    isFeatured,
    isActive,
  } = req.body;

  if (!isNonEmptyString(name)) throw new AppError("Product name is required", 400);
  if (!isNonEmptyString(category)) throw new AppError("Category is required", 400);
  if (price === undefined || Number.isNaN(Number(price))) {
    throw new AppError("A valid price is required", 400);
  }
  if (!isNonEmptyString(image)) throw new AppError("Product image is required", 400);

  const product = await Product.create({
    name: name.trim(),
    // Only used when supplied; otherwise it's generated from the name.
    ...(slug ? { slug: slug.trim().toLowerCase() } : {}),
    category: category.trim(),
    subcategory: subcategory || "",
    description: description || "",
    details: details || "",
    usage: usage || "",
    price: Number(price),
    discountPrice: Number(discountPrice) || 0,
    unit: unit || "",
    brand: brand || "",
    stock: toPositiveInt(stock, 0),
    image,
    gallery: Array.isArray(gallery) ? gallery : [],
    highlights: Array.isArray(highlights) ? highlights.filter(Boolean) : [],
    isFeatured: Boolean(isFeatured),
    isActive: isActive === undefined ? true : Boolean(isActive),
  });

  res.status(201).json({ success: true, message: "Product created", product });
});

// PUT /api/products/:id (protected + admin)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) throw new AppError("Product not found", 404);

  const fields = [
    "name",
    "slug",
    "category",
    "subcategory",
    "description",
    "details",
    "usage",
    "price",
    "discountPrice",
    "unit",
    "brand",
    "stock",
    "image",
    "gallery",
    "highlights",
    "isFeatured",
    "isActive",
    "tags",
  ];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      product[field] = field === "slug" ? req.body[field].trim().toLowerCase() : req.body[field];
    }
  });

  if (req.body.price !== undefined) product.price = Number(req.body.price);
  if (req.body.discountPrice !== undefined) product.discountPrice = Number(req.body.discountPrice) || 0;
  if (req.body.stock !== undefined) product.stock = toPositiveInt(req.body.stock, 0);

  await product.save();

  res.json({ success: true, message: "Product updated", product });
});

// DELETE /api/products/:id (protected + admin) — soft delete so order
// history keeps pointing at something real.
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) throw new AppError("Product not found", 404);

  product.isActive = false;
  await product.save();

  res.json({ success: true, message: "Product removed" });
});

module.exports = {
  getProducts,
  getCategories,
  getProductById,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
