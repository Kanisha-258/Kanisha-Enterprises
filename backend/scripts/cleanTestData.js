/**
 * Removes rows created by the automated test suites.
 *
 * Test runs leave behind throwaway products, orders, users and enquiries.
 * Run this between test runs, or before seeding a demo database.
 *
 *   node scripts/cleanTestData.js            (asks before deleting)
 *   node scripts/cleanTestData.js --dry      (lists what it WOULD delete)
 *   node scripts/cleanTestData.js --yes      (no prompt)
 *   node scripts/cleanTestData.js --all      (also deletes real customers/orders)
 */
require("dotenv").config();

const mongoose = require("mongoose");
const readline = require("node:readline");

const connectDB = require("../config/db");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Enquiry = require("../models/Enquiry");
const Coupon = require("../models/Coupon");
const Review = require("../models/Review");
const PasswordResetToken = require("../models/PasswordResetToken");

const args = process.argv.slice(2);
const assumeYes = args.includes("--yes") || args.includes("-y");
const removeAll = args.includes("--all");
const dryRun = args.includes("--dry");

// Matches the naming the test suites use.
//
// Test rows get a random suffix appended so slugs/SKUs stay unique, so most
// of these are prefix matches rather than exact ones.
const TEST_PATTERNS = {
  products: [/^Smoke Test Product/i, /^Another Product/i],
  users: [
    /^smoke\d+@test\.com$/i,
    /^other\d+@test\.com$/i,
    /^notadmin\d+@test\.com$/i,
    /^shopper\d+@test\.com$/i,
    /^ratelimit\d+@test\.com$/i,
    // phase1Test.js
    /^phase1\d+@test\.com$/i,
    /^still\d+@test\.com$/i,
    // Manual password-reset verification accounts
    /^pwflow\d+@test\.com$/i,
  ],
  // Seed/demo accounts confirmed by the shop owner as NOT real customers.
  // Listed explicitly so a real customer on a similar address is never
  // caught by a broad pattern.
  demo: [
    /^testfarmer@example\.com$/i,
    /^ramesh@example\.com$/i,
  ],
  // Enquiries: created with a "Bulk order" subject (smoke suite) and by
  // "Rate Test" (rate-limit suite).
  enquiries: [
    { subject: /^Bulk order$/i },
    { name: /^Rate Test$/i },
    { name: /^Smoke Tester$/i },
  ],
  // Coupon codes created by the test suites and by the Phase 1 admin-page check.
  coupons: [/^SMOKE/i, /^PHASE1TEST$/i],
  // Domains that only the automated suites ever use.
  testEmailDomain: /@test\.com$/i,
};

const confirm = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });

const run = async () => {
  await connectDB();
  console.log("Connected to MongoDB\n");

  if (dryRun) {
    console.log("DRY RUN — nothing will be deleted.\n");
  } else if (!assumeYes) {
    console.log("This will delete data created by the test suites.");
    console.log("Pass --dry to preview first, or --all to include real customers.\n");

    const ok = await confirm("Proceed? (y/N) ");
    if (!ok) {
      console.log("Cancelled.");
      process.exit(0);
    }
  }

  // --- Products created by tests ---
  // Select everything first, report it, and only then delete. In a dry run the
  // whole selection is printed and the function returns without writing.
  const testProducts = await Product.find({
    $or: TEST_PATTERNS.products.map((p) => ({ name: p })),
  }).select("_id name");

  // --- Test customers ---
  const userFilter = removeAll
    ? { role: { $ne: "admin" } }
    : {
        $or: [
          ...TEST_PATTERNS.users.map((p) => ({ email: p })),
          ...TEST_PATTERNS.demo.map((p) => ({ email: p })),
          { email: TEST_PATTERNS.testEmailDomain },
        ],
      };

  const testUsers = await User.find(userFilter).select("_id email role");
  const userIds = testUsers.map((u) => u._id);

  // --- Test enquiries ---
  const testEnquiries = await Enquiry.find({ $or: TEST_PATTERNS.enquiries }).select(
    "_id name email subject"
  );

  // --- Test coupons ---
  // `code` is a plain string field, so match each pattern as its own clause.
  const testCoupons = await Coupon.find({
    $or: TEST_PATTERNS.coupons.map((p) => ({ code: p })),
  }).select("_id code");

  // --- Everything a test account owns, counted for the report ---
  const [ownedOrders, ownedReviews, ownedTokens, testDomainEnquiries] = await Promise.all([
    Order.countDocuments({ user: { $in: userIds } }),
    Review.countDocuments({ user: { $in: userIds } }),
    PasswordResetToken.countDocuments({ user: { $in: userIds } }),
    Enquiry.countDocuments({ email: TEST_PATTERNS.testEmailDomain }),
  ]);

  // --- Report ---
  console.log("\n" + "=".repeat(64));
  console.log(dryRun ? "WOULD DELETE" : "DELETING");
  console.log("=".repeat(64));
  console.log(`Products           ${testProducts.length}`);
  testProducts.forEach((p) => console.log(`    - "${p.name}"`));
  console.log(`Users              ${testUsers.length}`);
  testUsers.forEach((u) => console.log(`    - ${u.email}  [${u.role}]`));
  console.log(`  their orders     ${ownedOrders}`);
  console.log(`  their reviews    ${ownedReviews}`);
  console.log(`  their tokens     ${ownedTokens}`);
  console.log(`Enquiries (named)  ${testEnquiries.length}`);
  testEnquiries.forEach((e) => console.log(`    - "${e.subject}" from ${e.email}`));
  console.log(`Enquiries (by @test.com email)  ${testDomainEnquiries}`);
  console.log(`Coupons            ${testCoupons.length}`);
  testCoupons.forEach((c) => console.log(`    - ${c.code}`));

  if (dryRun) {
    console.log("\nThis was a DRY RUN. Nothing was deleted.");
    console.log("Re-run without --dry to actually remove the above.\n");
    await mongoose.connection.close();
    process.exit(0);
  }

  // --- Delete ---
  if (testProducts.length) {
    await Product.deleteMany({ _id: { $in: testProducts.map((p) => p._id) } });
  }

  if (userIds.length) {
    // Reviews and orders owned by these throwaway accounts go with them.
    await Review.deleteMany({ user: { $in: userIds } });
    await Order.deleteMany({ user: { $in: userIds } });
    await PasswordResetToken.deleteMany({ user: { $in: userIds } });
    await Enquiry.deleteMany({ email: TEST_PATTERNS.testEmailDomain });

    if (removeAll) {
      // Never delete an admin account, whatever else was requested.
      await User.deleteMany({ _id: { $in: userIds }, role: { $ne: "admin" } });
    } else {
      await User.deleteMany({ _id: { $in: userIds } });
    }
  }

  await Enquiry.deleteMany({ _id: { $in: testEnquiries.map((e) => e._id) } });
  await Coupon.deleteMany({ _id: { $in: testCoupons.map((c) => c._id) } });

  // --- Summary ---
  console.log("\nCurrent state:");
  console.log(`  Products: ${await Product.countDocuments()}`);
  console.log(`  Orders:   ${await Order.countDocuments()}`);
  console.log(`  Customers:${await User.countDocuments({ role: { $ne: "admin" } })}`);
  console.log(`  Admins:   ${await User.countDocuments({ role: "admin" })}`);
  console.log(`  Enquiries:${await Enquiry.countDocuments()}`);
  console.log(`  Coupons:  ${await Coupon.countDocuments()}`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error("Clean-up failed:", error.message);
  process.exit(1);
});
