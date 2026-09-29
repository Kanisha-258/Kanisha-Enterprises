/**
 * READ-ONLY pre-flight check.
 *
 * Replays exactly the filters used by cleanTestData.js and prints what would
 * SURVIVE, so the decision to delete is made with the "after" picture visible,
 * not just the "before".
 *
 *   node scripts/previewSurvivors.js
 *
 * Never writes.
 */
require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Enquiry = require("../models/Enquiry");
const Coupon = require("../models/Coupon");
const Blog = require("../models/Blog");

// --- Same rules as cleanTestData.js ---
const DEMO = [/^testfarmer@example\.com$/i, /^ramesh@example\.com$/i];
const TEST_DOMAIN = /@test\.com$/i;
const isTestUser = (e = "") => TEST_DOMAIN.test(e) || DEMO.some((p) => p.test(e));

const isTestProduct = (n = "") =>
  /^Smoke Test Product/i.test(n) || /^Another Product/i.test(n);

const isTestCoupon = (c = "") => /^SMOKE/i.test(c) || /^PHASE1TEST$/i.test(c);

const isTestEnquiry = (e = {}) =>
  TEST_DOMAIN.test(e.email || "") ||
  /^Bulk order$/i.test(e.subject || "") ||
  /^Rate Test$/i.test(e.name || "") ||
  /^Smoke Tester$/i.test(e.name || "");

const run = async () => {
  await connectDB();
  console.log("\nWHAT WOULD REMAIN AFTER A CLEAN (read-only preview)\n");
  console.log("=".repeat(62));

  // Users
  const users = await User.find().select("email role name");
  const keepUsers = users.filter((u) => !isTestUser(u.email));
  const delUsers = users.filter((u) => isTestUser(u.email));

  console.log(`\nUSERS KEPT (${keepUsers.length} of ${users.length})`);
  keepUsers.forEach((u) => console.log(`   ${u.email}  [${u.role}]  "${u.name}"`));

  const admins = users.filter((u) => u.role === "admin");
  const adminsAtRisk = admins.filter((a) => delUsers.some((d) => d.email === a.email));
  console.log(
    `\n   ADMIN ACCOUNTS AT RISK: ${
      adminsAtRisk.length
        ? adminsAtRisk.map((a) => a.email).join(", ")
        : "NONE - safe"
    }`
  );

  // Products
  const products = await Product.find().select("name isActive");
  const keepProducts = products.filter((p) => !isTestProduct(p.name));
  console.log(`\nPRODUCTS KEPT (${keepProducts.length} of ${products.length})`);
  const visible = keepProducts.filter((p) => p.isActive);
  console.log(`   (${visible.length} of them active and visible in the shop)`);

  // Orders
  const orders = await Order.find().populate("user", "email").select("orderNumber user total orderStatus");
  const keepOrders = orders.filter((o) => !isTestUser(o.user?.email));
  console.log(`\nORDERS KEPT (${keepOrders.length} of ${orders.length})`);
  keepOrders.forEach((o) =>
    console.log(`   ${o.orderNumber}  Rs${o.total}  ${o.orderStatus}  by ${o.user?.email ?? "(none)"}`)
  );

  // Enquiries
  const enquiries = await Enquiry.find().select("name email subject");
  const keepEnq = enquiries.filter((e) => !isTestEnquiry(e));
  console.log(`\nENQUIRIES KEPT (${keepEnq.length} of ${enquiries.length})`);
  keepEnq.forEach((e) =>
    console.log(`   "${e.subject}" from ${e.name} <${e.email}>`)
  );

  // Coupons
  const coupons = await Coupon.find().select("code");
  const keepCoupons = coupons.filter((c) => !isTestCoupon(c.code));
  console.log(`\nCOUPONS KEPT (${keepCoupons.length} of ${coupons.length})`);
  keepCoupons.forEach((c) => console.log(`   ${c.code}`));

  // Blogs
  console.log(`\nBLOGS KEPT (${await Blog.countDocuments()}) - never touched`);

  console.log(`\n${"=".repeat(62)}`);
  console.log("Nothing was modified. This script only reads.");
  process.exit(0);
};

run().catch((e) => {
  console.error("Preview failed:", e.message);
  process.exit(1);
});
