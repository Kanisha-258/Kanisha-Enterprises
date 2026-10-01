const express = require("express");

const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
} = require("../controllers/orderController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(authMiddleware);

// Admin endpoints must be declared before "/:id", otherwise Express would
// try to parse "admin" as an order id and return a misleading 404.
router.get("/admin/all", adminMiddleware, getAllOrders);
router.put("/admin/:id/status", adminMiddleware, updateOrderStatus);
router.put("/admin/:id/payment", adminMiddleware, updatePaymentStatus);

// Customer endpoints
router.post("/", requestLimiter({ windowMs: 60 * 1000, max: 10 }), createOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.put("/:id/cancel", cancelOrder);

module.exports = router;
