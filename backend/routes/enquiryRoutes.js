const express = require("express");

const {
  createEnquiry,
  getEnquiries,
  updateEnquiryStatus,
  deleteEnquiry,
} = require("../controllers/enquiryController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Public form submission — rate limited so it can't be used to spam the inbox.
router.post(
  "/",
  requestLimiter({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: "Too many enquiries. Please try again later.",
  }),
  createEnquiry
);

// Admin-only
router.get("/admin/all", authMiddleware, adminMiddleware, getEnquiries);
router.put("/admin/:id/status", authMiddleware, adminMiddleware, updateEnquiryStatus);
router.delete("/admin/:id", authMiddleware, adminMiddleware, deleteEnquiry);

module.exports = router;
