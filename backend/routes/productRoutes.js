const express = require("express");

const {
  getProducts,
  getCategories,
  getProductById,
} = require("../controllers/productController");

const { requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// General browsing limiter — generous, just stops runaway loops.
const browseLimiter = requestLimiter({ windowMs: 60 * 1000, max: 120 });

router.get("/", browseLimiter, getProducts);
router.get("/categories", browseLimiter, getCategories);
router.get("/:idOrSlug", browseLimiter, getProductById);

module.exports = router;
