require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const initDatabase = require("./utils/ensureIndexes");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const blogRoutes = require("./routes/blogRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const couponRoutes = require("./routes/couponRoutes");
const cartRoutes = require("./routes/cartRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

connectDB();

// Allow the configured frontends, comma-separated.
//
// This is a real allowlist, not a wildcard: anyone who can reach this API can
// call it, so the set of origins that may do so is configuration rather than a
// hardcoded "*". Set CLIENT_URL to the deployed frontend's origin.
//
// "*" is still accepted as a value, because it is genuinely useful while
// developing against several local frontends. The two are mutually exclusive
// though: the CORS spec forbids pairing a wildcard origin with credentialed
// requests, and the browser rejects that combination outright. So credentials
// are only enabled for an explicit allowlist.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowAnyOrigin = allowedOrigins.includes("*");

app.use(
  cors({
    origin: allowAnyOrigin ? "*" : allowedOrigins,
    ...(allowAnyOrigin ? {} : { credentials: true }),
  })
);

// A body larger than 1MB is almost certainly abuse.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Small hardening headers (no dependency needed).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Kanisha Enterprises API is running 🌱",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products/admin", adminProductRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);

// The customer's saved cart. Applied after the product routes, which are
// public, because these all need a session.
app.use("/api/cart", cartRoutes);

// Suppliers, purchases and stock history. This router applies authMiddleware
// and adminMiddleware itself, so there is no customer-facing route into it.
app.use("/api/admin", inventoryRoutes);

// Unmatched route -> error -> handler. Must stay last.
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🌱 Kanisha Enterprises API running on port ${PORT}`);
  console.log(
    `   CORS allowed for: ${allowAnyOrigin ? "* (any origin)" : allowedOrigins.join(", ")}`
  );
});

// Indexes must be built after the connection is up. Without this, the
// `unique: true` constraints in the schemas are never enforced.
initDatabase();
