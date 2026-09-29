/** Blocks a route unless the signed-in user is an admin. Must run after authMiddleware. */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action",
    });
  }

  return next();
};

module.exports = adminMiddleware;
