const express = require("express");

const {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  checkResetToken,
  addAddress,
  updateAddress,
  deleteAddress,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const { failedAttemptLimiter, requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Only *failed* sign-in attempts count, so a busy shop on one computer or a
// customer on shared mobile data never gets locked out by ordinary use.
const authLimiter = failedAttemptLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many failed attempts. Please try again in 15 minutes.",
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

// Password reset. These count *every* request, not just failures: a successful
// request still creates a token (and will eventually send an email), so a
// failure-only limiter would not stop spam or token guessing.
const forgotLimiter = requestLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests. Please try again in 15 minutes.",
});

// Redeeming a token: the token is 256 bits and unguessable, so this cap only
// needs to stop brute force, not ordinary retries.
const resetLimiter = requestLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset attempts. Please try again in 15 minutes.",
});

router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password", resetLimiter, resetPassword);
router.get("/reset-password/status", resetLimiter, checkResetToken);

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.put("/password", authMiddleware, changePassword);

router.post("/addresses", authMiddleware, addAddress);
router.put("/addresses/:addressId", authMiddleware, updateAddress);
router.delete("/addresses/:addressId", authMiddleware, deleteAddress);

module.exports = router;
