const express = require("express");

const { validateCoupon, getConfig } = require("../controllers/couponController");

const authMiddleware = require("../middleware/authMiddleware");
const { requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Delivery thresholds, so the cart/checkout pages don't hardcode numbers that
// the backend can change via .env.
router.get("/config", getConfig);

// Prices a cart against a coupon. Requires a session because it reads live
// prices and stock for the signed-in customer's cart.
router.post(
  "/validate",
  authMiddleware,
  requestLimiter({ windowMs: 60 * 1000, max: 30 }),
  validateCoupon
);

module.exports = router;
