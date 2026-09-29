/**
 * Seeds a few sample discount codes so the checkout can be tested
 * straight away. Delete the ones you don't want to advertise.
 */
require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("./config/db");
const Coupon = require("./models/Coupon");

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const coupons = [
  {
    code: "HARVEST10",
    description: "10% off your order (max ₹150 off)",
    type: "percentage",
    value: 10,
    maxDiscount: 150,
    minOrderValue: 500,
    validUntil: daysFromNow(90),
    isActive: true,
  },
  {
    code: "FARMER200",
    description: "Flat ₹200 off orders over ₹1500",
    type: "flat",
    value: 200,
    minOrderValue: 1500,
    validUntil: daysFromNow(60),
    isActive: true,
  },
  {
    code: "SEEDS5",
    description: "5% off on all seed products",
    type: "percentage",
    value: 5,
    minOrderValue: 0,
    appliesTo: ["Seeds"],
    usageLimit: 100,
    validUntil: daysFromNow(30),
    isActive: true,
  },
];

const seedCoupons = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const codes = coupons.map((c) => c.code);
    await Coupon.deleteMany({ code: { $in: codes } });

    const inserted = await Coupon.insertMany(coupons);
    console.log(`${inserted.length} coupons inserted: ${codes.join(", ")}`);

    await mongoose.connection.close();
    console.log("Connection closed. Seeding complete.");
    process.exit(0);
  } catch (error) {
    console.error("Coupon seed error:", error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

seedCoupons();
