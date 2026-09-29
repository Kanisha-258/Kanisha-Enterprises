const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const { toPage, toLimit } = require("../utils/validators");

// GET /api/reviews/product/:productId — public
const getProductReviews = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 10, 50);

  const filter = { product: req.params.productId, isApproved: true };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: reviews.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    reviews,
  });
});

// POST /api/reviews   (protected) — only customers who actually bought it
const createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment } = req.body;
  const user = req.user;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw new AppError("Product not found", 404);
  }

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new AppError("Please choose a rating between 1 and 5", 400);
  }

  // Must have a delivered order containing this product.
  const purchase = await Order.findOne({
    user: user._id,
    orderStatus: "delivered",
    "items.product": product._id,
  });

  if (!purchase) {
    throw new AppError("You can only review products from a delivered order", 403);
  }

  if (await Review.exists({ product: product._id, user: user._id })) {
    throw new AppError("You have already reviewed this product", 409);
  }

  const review = await Review.create({
    product: product._id,
    user: user._id,
    userName: user.name,
    rating: Math.round(numericRating),
    comment: comment || "",
  });

  await Review.syncProductRating(product._id);

  res.status(201).json({ success: true, message: "Thank you for your review", review });
});

// PUT /api/reviews/:id   (protected) — author only
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("Review not found", 404);

  const isAuthor = String(review.user) === String(req.user._id);
  if (!isAuthor && req.user.role !== "admin") {
    throw new AppError("You can only edit your own review", 403);
  }

  if (req.body.rating !== undefined) {
    const numeric = Number(req.body.rating);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
      throw new AppError("Rating must be between 1 and 5", 400);
    }
    review.rating = Math.round(numeric);
  }
  if (req.body.comment !== undefined) review.comment = req.body.comment;

  await review.save();
  await Review.syncProductRating(review.product);

  res.json({ success: true, message: "Review updated", review });
});

// DELETE /api/reviews/:id   (protected) — author or admin
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError("Review not found", 404);

  const isAuthor = String(review.user) === String(req.user._id);
  if (!isAuthor && req.user.role !== "admin") {
    throw new AppError("You can only delete your own review", 403);
  }

  const productId = review.product;
  await review.deleteOne();
  await Review.syncProductRating(productId);

  res.json({ success: true, message: "Review removed" });
});

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
};
