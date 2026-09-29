require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const Product = require("../models/Product");
  const Blog = require("../models/Blog");
  const Coupon = require("../models/Coupon");
  const Order = require("../models/Order");
  const User = require("../models/User");
  const Enquiry = require("../models/Enquiry");
  const Review = require("../models/Review");

  const line = (label, n) => console.log(`  ${String(label).padEnd(26)} ${n}`);

  console.log("\nDatabase state\n" + "-".repeat(34));
  line("Products", await Product.countDocuments());
  line("  featured", await Product.countDocuments({ isFeatured: true }));
  line("  with slug", await Product.countDocuments({ slug: { $exists: true } }));
  line("  with sku", await Product.countDocuments({ sku: { $exists: true } }));
  line("  with highlights", await Product.countDocuments({ highlights: { $exists: true } }));
  line("  on offer", await Product.countDocuments({ discountPrice: { $gt: 0 } }));
  line("Blog posts", await Blog.countDocuments());
  line("Coupons", await Coupon.countDocuments());
  line("Orders", await Order.countDocuments());
  line("Reviews", await Review.countDocuments());
  line("Enquiries", await Enquiry.countDocuments());
  line("Users", await User.countDocuments());
  line("  admins", await User.countDocuments({ role: "admin" }));

  const cats = await Product.distinct("category");
  line("Categories", cats.length);
  console.log("    " + cats.join(", "));

  await mongoose.disconnect();
})();
