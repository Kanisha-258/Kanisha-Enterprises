const jwt = require("jsonwebtoken");

const User = require("../models/User");

/**
 * Verifies the Bearer token and attaches the *live* user document to req.user.
 *
 * Looking the user up on every request (rather than trusting the token body)
 * means a deleted or deactivated account loses access immediately instead of
 * staying valid until the token expires.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "This account no longer exists",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    // Expired and malformed tokens are both routine — don't log them as errors.
    const expired = error.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      message: expired ? "Your session has expired. Please log in again." : "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;
