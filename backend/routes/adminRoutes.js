const express = require("express");

const {
  getStats,
  getUsers,
  updateUser,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get("/stats", getStats);

router.get("/users", getUsers);
router.put("/users/:id", updateUser);

router.get("/coupons", getCoupons);
router.post("/coupons", createCoupon);
router.put("/coupons/:id", updateCoupon);
router.delete("/coupons/:id", deleteCoupon);

module.exports = router;
