/**
 * Creates (or updates) the shop's admin account.
 *
 * Usage:
 *   node seedAdmin.js
 *   node seedAdmin.js --email=owner@kanisha.com --password="Str0ngPass!" --name="Kanisha"
 *
 * With no arguments it reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from
 * .env, and generates a strong random password if none is set (printed once).
 */
require("dotenv").config();

const mongoose = require("mongoose");
const crypto = require("crypto");

const connectDB = require("./config/db");
const User = require("./models/User");

const args = process.argv.slice(2);
const argValue = (name) => {
  const match = args.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split("=").slice(1).join("=") : undefined;
};

const email = (argValue("email") || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const name = (argValue("name") || process.env.ADMIN_NAME || "Shop Owner").trim();

// Reuse an explicit password, otherwise generate a hard-to-guess one.
let password = argValue("password") || process.env.ADMIN_PASSWORD;
const generatedPassword = !password;

if (generatedPassword) {
  password = `${crypto.randomBytes(4).toString("hex")}-Ke${crypto.randomBytes(4).toString("hex")}`;
}

if (!email) {
  console.error("❌ No admin email supplied.");
  console.error("   Run: node seedAdmin.js --email=you@example.com --name=\"Your Name\"");
  process.exit(1);
}

if (password.length < 8) {
  console.error("❌ Admin password must be at least 8 characters.");
  process.exit(1);
}

const seedAdmin = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const existing = await User.findOne({ email }).select("+password");

    if (existing) {
      // Re-running is safe: it promotes the account to admin and rehashes
      // the password rather than creating a duplicate.
      const bcrypt = require("bcryptjs");

      existing.name = name;
      existing.password = await bcrypt.hash(password, 12);
      existing.role = "admin";
      existing.isActive = true;
      await existing.save();

      console.log(`\n✅ Existing account ${email} promoted to admin and password reset.`);
    } else {
      const bcrypt = require("bcryptjs");

      await User.create({
        name,
        email,
        // A placeholder; the owner should reset it after first login.
        phone: process.env.ADMIN_PHONE || "9999999999",
        password: await bcrypt.hash(password, 12),
        role: "admin",
        isActive: true,
      });

      console.log(`\n✅ Admin account created for ${email}`);
    }

    console.log("   Name     :", name);
    console.log("   Email    :", email);
    console.log("   Password :", password);

    if (generatedPassword) {
      console.log("\n   ⚠️  This password was generated and shown only once — save it now.");
    }

    console.log("\n   Log in at /login, then open /admin\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Admin seed error:", error.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

seedAdmin();
