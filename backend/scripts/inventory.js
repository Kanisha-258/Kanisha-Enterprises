/**
 * Read-only database inventory.
 *
 * Lists every row in every collection, classified as TEST or BUSINESS, so you
 * can see exactly what a clean-up would remove BEFORE anything is deleted.
 *
 *   node scripts/inventory.js
 *
 * This script NEVER writes. It only reads.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");

const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Enquiry = require("../models/Enquiry");
const Coupon = require("../models/Coupon");
const Review = require("../models/Review");
const Blog = require("../models/Blog");
const PasswordResetToken = require("../models/PasswordResetToken");

// How we tell a throwaway test row from real business data.
// Kept in one place so the classification is auditable.
const isTest = {
  email: (e = "") =>
    /@test\.com$/i.test(e) ||
    /^smoke\d+/i.test(e) ||
    /^phase1\d+/i.test(e) ||
    /^still\d+/i.test(e) ||
    /^pwflow\d+/i.test(e) ||
    /^ratelimit\d+/i.test(e) ||
    /^shopper\d+/i.test(e) ||
    /^other\d+/i.test(e) ||
    /^notadmin\d+/i.test(e),
  // Test rows get a random suffix appended to keep slugs/SKUs unique, so
  // these are prefix matches, not exact ones.
  name: (n = "") =>
    /^Smoke Test Product/i.test(n) ||
    /^Another Product/i.test(n) ||
    /^Smoke Tester$/i.test(n) ||
    /^Rate Test$/i.test(n) ||
    /^Phase One$/i.test(n) ||
    /^Still Works$/i.test(n) ||
    /^PW Flow/i.test(n),
  subject: (s = "") => /^Bulk order$/i.test(s),
  couponCode: (c = "") => /^(SMOKE|PHASE1TEST)/i.test(c),
};

const line = (n = 60) => "-".repeat(n);

const show = (rows, classify, format) => {
  const test = rows.filter((r) => classify(r));
  const real = rows.filter((r) => !classify(r));

  if (real.length) {
    console.log(`  KEEP (${real.length}) — real business data:`);
    real.forEach((r) => console.log(`    ${format(r)}`));
  }
  if (test.length) {
    console.log(`  DELETE (${test.length}) — test data:`);
    test.forEach((r) => console.log(`    ${format(r)}`));
  }
  if (!rows.length) console.log("  (empty)");

  return { total: rows.length, test: test.length, keep: real.length };
};

const run = async () => {
  await connectDB();
  console.log("\nDatabase inventory (read-only — nothing is modified)\n");
  console.log(line());

  // ---------------- Users ----------------
  const users = await User.find().select("name email role isActive createdAt");
  console.log(`\nUSERS (${users.length})`);
  console.log(line(50));
  const u = show(
    users,
    (r) => isTest.email(r.email) || isTest.name(r.name),
    (r) =>
      `${r.email}  [${r.role}]  "${r.name}"${r.isActive ? "" : "  (inactive)"}`
  );

  // ---------------- Products ----------------
  const products = await Product.find().select("name stock isActive price");
  console.log(`\nPRODUCTS (${products.length})`);
  console.log(line(50));
  const p = show(
    products,
    (r) => isTest.name(r.name),
    (r) => `"${r.name}"  stock=${r.stock}  ₹${r.price}${r.isActive ? "" : "  (INACTIVE)"}`
  );

  // ---------------- Orders ----------------
  const orders = await Order.find()
    .populate("user", "email")
    .select("orderNumber total orderStatus createdAt user");
  console.log(`\nORDERS (${orders.length})`);
  console.log(line(50));
  const o = show(
    orders,
    (r) => isTest.email(r.user?.email),
    (r) =>
      `${r.orderNumber}  ₹${r.total}  ${r.orderStatus}  by ${r.user?.email ?? "(no user)"}  ${new Date(
        r.createdAt
      ).toISOString().slice(0, 16).replace("T", " ")}`
  );

  // ---------------- Enquiries ----------------
  const enquiries = await Enquiry.find().populate("product", "name").select("name email subject product createdAt");
  console.log(`\nENQUIRIES (${enquiries.length})`);
  console.log(line(50));
  const q = show(
    enquiries,
    (r) => isTest.subject(r.subject) || isTest.name(r.name) || isTest.email(r.email),
    (r) =>
      `"${r.name}" <${r.email}>  "${r.subject}"  product=${r.product?.name ?? "-"}  ${new Date(
        r.createdAt
      ).toISOString().slice(0, 16).replace("T", " ")}`
  );

  // ---------------- Coupons ----------------
  const coupons = await Coupon.find().select("code description type value isActive usedCount validUntil");
  console.log(`\nCOUPONS (${coupons.length})`);
  console.log(line(50));
  const c = show(
    coupons,
    (r) => isTest.couponCode(r.code),
    (r) =>
      `${r.code}  ${r.type} ${r.value}  used=${r.usedCount}  ${
        r.isActive ? "active" : "PAUSED"
      }  ${r.validUntil ? "until " + new Date(r.validUntil).toISOString().slice(0, 10) : "no expiry"}  "${
        r.description || ""
      }"`
  );

  // ---------------- Reviews ----------------
  const reviews = await Review.find().populate("user", "email").select("user comment rating");
  console.log(`\nREVIEWS (${reviews.length})`);
  console.log(line(50));
  const rv = show(
    reviews,
    (r) => isTest.email(r.user?.email),
    (r) => `${r.rating}*  "${(r.comment || "").slice(0, 60)}"  by ${r.user?.email ?? "?"}`
  );

  // ---------------- Blogs ----------------
  const blogs = await Blog.find().select("title isPublished createdAt");
  console.log(`\nBLOGS (${blogs.length})`);
  console.log(line(50));
  const b = show(
    blogs,
    () => false, // never auto-classified as test
    (r) => `"${r.title}"  ${r.isPublished ? "published" : "draft"}`
  );

  // ---------------- Password reset tokens ----------------
  const tokens = await PasswordResetToken.find()
    .populate("user", "email")
    .select("user expiresAt usedAt createdAt");
  console.log(`\nPASSWORD RESET TOKENS (${tokens.length})`);
  console.log(line(50));
  const t = show(
    tokens,
    (r) => isTest.email(r.user?.email),
    (r) =>
      `for ${r.user?.email ?? "(deleted user)"}  expires ${new Date(r.expiresAt)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")}  ${r.usedAt ? "USED" : "unused"}`
  );

  // ---------------- Summary ----------------
  console.log(`\n${line(80)}\nSUMMARY\n${line(80)}`);
  const rows = [
    ["Users", u],
    ["Products", p],
    ["Orders", o],
    ["Enquiries", q],
    ["Coupons", c],
    ["Reviews", rv],
    ["Blogs", b],
    ["Reset tokens", t],
  ];

  let del = 0;
  let keep = 0;
  console.log(`${"Collection".padEnd(16)}${"Total".padStart(7)}${"Delete".padStart(9)}${"Keep".padStart(7)}`);
  rows.forEach(([label, r]) => {
    del += r.test;
    keep += r.keep;
    console.log(
      `${label.padEnd(16)}${String(r.total).padStart(7)}${String(r.test).padStart(9)}${String(r.keep).padStart(7)}`
    );
  });
  console.log(`${"".padEnd(16)}${"".padStart(7)}${"".padStart(7)}${"".padStart(7)}`);
  console.log(`${"TOTAL".padEnd(16)}${String(del + keep).padStart(7)}${String(del).padStart(9)}${String(keep).padStart(7)}`);

  console.log(`\nNo changes were made. Nothing was deleted.`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error("\nInventory failed:", error.message);
  process.exit(1);
});
