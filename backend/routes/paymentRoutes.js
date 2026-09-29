const express = require("express");

const {
  getConfig,
  createPaymentOrder,
  verifyPayment,
  cancelPayment,
} = require("../controllers/paymentController");

const authMiddleware = require("../middleware/authMiddleware");
const { requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Public — lets the checkout page decide whether to offer online payment.
router.get("/config", getConfig);

router.use(authMiddleware);

router.post(
  "/create-order",
  requestLimiter({ windowMs: 60 * 1000, max: 10 }),
  createPaymentOrder
);
router.post("/verify", verifyPayment);
router.post("/cancel", cancelPayment);

module.exports = router;
