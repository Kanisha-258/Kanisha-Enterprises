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
const Supplier = require("../models/Supplier");
const Purchase = require("../models/Purchase");
const StockMovement = require("../models/StockMovement");
const Cart = require("../models/Cart");

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
  // Phase 2 suppliers, purchases and manual-adjustment notes.
  suppliers: [/^PhaseTwoTest /i],
  purchaseNotes: [/Phase 2 test/i],
  movementReasons: [/Phase 2 test/i],

  // Manual browser-verification rows. These are created by hand in the admin
  // UI rather than by a script, so they need their own prefixes. All are
  // distinctive enough that no real record could match them.
  verificationProducts: [/^VERIFPROD/i, /^UNMOUNTPROD/i],
  verificationSuppliers: [
    /^VERIFICATION Supplier$/i,
    /^UNMOUNT Supplier$/i,
    /^RERUN Supplier$/i,
    /^Sunita Seed Company$/i,
    /^Krishna Fertilizers$/i,
    /^Anand Agro Center$/i,
    /^Ramesh Patil$/i,
  ],
  verificationCoupons: [/^VERIF20CODE$/i],
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

  // Products created by manual browser verification, e.g. VERIFPROD.
  const verificationProducts = await Product.find({
    $or: TEST_PATTERNS.verificationProducts.map((p) => ({ name: p })),
  }).select("_id name");

  // Suppliers and coupons created by manual browser verification.
  const verificationSuppliers = await Supplier.find({
    $or: TEST_PATTERNS.verificationSuppliers.map((p) => ({ name: p })),
  }).select("_id name");

  const verificationCoupons = await Coupon.find({
    $or: TEST_PATTERNS.verificationCoupons.map((p) => ({ code: p })),
  }).select("_id code");

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

  // --- Phase 2 suppliers and purchases ---
  // Matched on a dedicated name prefix, so a real supplier with a similar name
  // is never caught.
  const testSuppliers = await Supplier.find({
    $or: TEST_PATTERNS.suppliers.map((p) => ({ name: p })),
  }).select("_id name");

  const testSupplierIds = [
    ...testSuppliers.map((s) => s._id),
    ...verificationSuppliers.map((s) => s._id),
  ];

  // Purchases left pointing at a supplier that no longer exists. These are
  // orphans from an earlier version of this script that deleted suppliers
  // before their purchases, and can only be test rows: the API never allows a
  // supplier with purchase history to be hard-deleted, so a real purchase
  // can't end up in this state.
  const orphanedPurchases = await Purchase.aggregate([
    { $lookup: { from: "suppliers", localField: "supplier", foreignField: "_id", as: "s" } },
    { $match: { s: { $size: 0 } } },
    { $project: { _id: 1, purchaseNumber: 1, total: 1, status: 1 } },
  ]);

  // Keyed off the test suppliers rather than the notes field, because most test
  // purchases are created without any note and would otherwise survive.
  const testPurchases = await Purchase.find({
    $or: [
      { supplier: { $in: testSupplierIds } },
      ...TEST_PATTERNS.purchaseNotes.map((p) => ({ notes: p })),
    ],
  }).select("_id purchaseNumber");

  // Stock movements the Phase 2 suite created when it normalised stock, so its
  // assertions start from a known number next run.
  const testMovements = await StockMovement.find({
    $or: TEST_PATTERNS.movementReasons.map((p) => ({ reason: p })),
  }).select("_id");

  // --- Everything a test account owns, counted for the report ---
  const [ownedOrders, ownedReviews, ownedTokens, ownedCarts, testDomainEnquiries] =
    await Promise.all([
      Order.countDocuments({ user: { $in: userIds } }),
      Review.countDocuments({ user: { $in: userIds } }),
      PasswordResetToken.countDocuments({ user: { $in: userIds } }),
      Cart.countDocuments({ user: { $in: userIds } }),
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
  console.log(`  their carts      ${ownedCarts}`);
  console.log(`Enquiries (named)  ${testEnquiries.length}`);
  testEnquiries.forEach((e) => console.log(`    - "${e.subject}" from ${e.email}`));
  console.log(`Enquiries (by @test.com email)  ${testDomainEnquiries}`);
  console.log(`Coupons            ${testCoupons.length}`);
  testCoupons.forEach((c) => console.log(`    - ${c.code}`));
  console.log(`Suppliers          ${testSuppliers.length}`);
  testSuppliers.forEach((s) => console.log(`    - ${s.name}`));
  console.log(`Purchases          ${testPurchases.length}`);
  testPurchases.forEach((p) => console.log(`    - ${p.purchaseNumber}`));
  console.log(`  orphaned         ${orphanedPurchases.length}`);
  orphanedPurchases.forEach((p) =>
    console.log(`    - ${p.purchaseNumber}  (Rs${p.total}, ${p.status}, supplier missing)`)
  );
  console.log(`Stock movements    ${testMovements.length} (stock normalisation)`);
  console.log(`Verification rows`);
  console.log(`  products        ${verificationProducts.length}`);
  verificationProducts.forEach((p) => console.log(`    - ${p.name}`));
  console.log(`  suppliers       ${verificationSuppliers.length}`);
  verificationSuppliers.forEach((s) => console.log(`    - ${s.name}`));
  console.log(`  coupons         ${verificationCoupons.length}`);
  verificationCoupons.forEach((c) => console.log(`    - ${c.code}`));

  if (dryRun) {
    console.log("\nThis was a DRY RUN. Nothing was deleted.");
    console.log("Re-run without --dry to actually remove the above.\n");
    await mongoose.connection.close();
    process.exit(0);
  }

  // --- Delete ---
  if (testProducts.length || verificationProducts.length) {
    await Product.deleteMany({
      _id: {
        $in: [...testProducts.map((p) => p._id), ...verificationProducts.map((p) => p._id)],
      },
    });
  }

  if (verificationCoupons.length) {
    await Coupon.deleteMany({ _id: { $in: verificationCoupons.map((c) => c._id) } });
  }

  if (userIds.length) {
    // Reviews, orders, saved carts and tokens owned by these throwaway
    // accounts go with them.
    await Review.deleteMany({ user: { $in: userIds } });
    await Order.deleteMany({ user: { $in: userIds } });
    await Cart.deleteMany({ user: { $in: userIds } });
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

  if (testPurchases.length) {
    // Purchases first, then their suppliers. Deleting the supplier first would
    // leave the purchase pointing at nothing, and the next run — which finds
    // test purchases by their supplier — would no longer recognise it.
    await Purchase.deleteMany({ _id: { $in: testPurchases.map((p) => p._id) } });
  }

  if (orphanedPurchases.length) {
    // No supplier to match on any more, so these can only be identified by
    // being broken. Cleared here so the ledger doesn't accumulate debris.
    await Purchase.deleteMany({ _id: { $in: orphanedPurchases.map((p) => p._id) } });
  }

  if (testSuppliers.length) {
    await Supplier.deleteMany({ _id: { $in: testSupplierIds } });
  }

  if (testMovements.length) {
    // Movements are immutable in normal operation. These are only the Phase 2
    // suite's own stock-normalisation rows, which it will recreate on the next
    // run, so removing them can't hide a real stock discrepancy.
    await StockMovement.deleteMany({ _id: { $in: testMovements.map((m) => m._id) } });
  }

  // --- Summary ---
  console.log("\nCurrent state:");
  console.log(`  Products: ${await Product.countDocuments()}`);
  console.log(`  Orders:   ${await Order.countDocuments()}`);
  console.log(`  Customers:${await User.countDocuments({ role: { $ne: "admin" } })}`);
  console.log(`  Admins:   ${await User.countDocuments({ role: "admin" })}`);
  console.log(`  Enquiries:${await Enquiry.countDocuments()}`);
  console.log(`  Coupons:  ${await Coupon.countDocuments()}`);
  console.log(`  Suppliers:${await Supplier.countDocuments()}`);
  console.log(`  Purchases:${await Purchase.countDocuments()}`);
  console.log(`  Movements:${await StockMovement.countDocuments()}`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error("Clean-up failed:", error.message);
  process.exit(1);
});
