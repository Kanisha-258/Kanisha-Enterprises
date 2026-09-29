const AppError = require("../utils/AppError");

/** Catch-all for routes that don't exist. */
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, next) => {
  // Start from a safe default, then let the error override the details.
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong on our end";
  let errors;

  // Duplicate key (e.g. registering an existing email).
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || { field: "" })[0];
    statusCode = 409;

    if (field === "email") {
      message = "An account with this email already exists";
    } else if (field === "slug") {
      message = "A product with this web address (slug) already exists";
    } else if (field === "code") {
      message = "A coupon with this code already exists";
    } else {
      message = `That ${field} is already in use`;
    }
  }

  // Schema validation error.
  if (err.name === "ValidationError") {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = errors[0] || "Please check the details you entered";
  }

  // Malformed ObjectId in the URL.
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid identifier";
  }

  if (statusCode >= 500) {
    // Log the real cause server-side, but never leak it to the client.
    console.error("Unhandled error:", err);
    message = "Something went wrong on our end";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

module.exports = { notFound, errorHandler };
