const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const PasswordResetToken = require("../models/PasswordResetToken");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const { toPublicUser } = require("../utils/sanitize");
const { isEmail, isPhone, isNonEmptyString } = require("../utils/validators");

const BCRYPT_ROUNDS = 12;

// How long a reset link stays usable.
const RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60);

// Refuse to issue more than this many live tokens for one account.
const MAX_ACTIVE_REQUESTS_PER_USER = 3;

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

/** 32 random bytes, URL-safe. 256 bits of entropy. */
const createRawToken = () => crypto.randomBytes(32).toString("hex");

/** Tokens are stored hashed, so a database dump can't be replayed. */
const hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

/**
 * Constant-time comparison of two hex digests, so a request can't be used to
 * discover a valid token one character at a time.
 */
const safeEqualHex = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
};

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, address, city, state, pincode } = req.body;

  if (!isNonEmptyString(name)) {
    throw new AppError("Please enter your name", 400);
  }
  if (!isEmail(email)) {
    throw new AppError("Please enter a valid email address", 400);
  }
  if (!isPhone(phone)) {
    throw new AppError("Phone number must be exactly 10 digits", 400);
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const normalisedEmail = email.trim().toLowerCase();

  if (await User.exists({ email: normalisedEmail })) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Note: `role` is never read from the request body, so a user can never
  // register themselves as an admin.
  const user = await User.create({
    name: name.trim(),
    email: normalisedEmail,
    phone: phone.trim(),
    password: hashedPassword,
    address,
    city,
    state,
    pincode,
  });

  res.status(201).json({
    success: true,
    message: "Registration successful",
    token: generateToken(user),
    user: toPublicUser(user),
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isEmail(email) || typeof password !== "string" || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  }).select("+password");

  // Same message for "no such user" and "wrong password" so the response
  // can't be used to discover which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("This account has been deactivated", 403);
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: "Login successful",
    token: generateToken(user),
    user: toPublicUser(user),
  });
});

// GET /api/auth/me   (protected)
const getMe = asyncHandler(async (req, res) => {
  // authMiddleware has already loaded the live user document.
  res.json({ success: true, user: toPublicUser(req.user) });
});

// PUT /api/auth/me   (protected) — update profile fields
const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, address, city, state, pincode } = req.body;
  const user = req.user;

  if (name !== undefined) {
    if (!isNonEmptyString(name)) throw new AppError("Name cannot be empty", 400);
    user.name = name.trim();
  }
  if (phone !== undefined) {
    if (!isPhone(phone)) throw new AppError("Phone number must be exactly 10 digits", 400);
    user.phone = phone.trim();
  }

  if (address !== undefined) user.address = address;
  if (city !== undefined) user.city = city;
  if (state !== undefined) user.state = state;
  if (pincode !== undefined) user.pincode = pincode;

  await user.save();

  res.json({ success: true, message: "Profile updated", user: toPublicUser(user) });
});

// PUT /api/auth/password   (protected) — change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== "string" || !currentPassword) {
    throw new AppError("Your current password is required", 400);
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters", 400);
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  // Any outstanding reset links are now irrelevant.
  await PasswordResetToken.updateMany(
    { user: user._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  res.json({ success: true, message: "Password changed successfully" });
});

// --- Password reset ---

/**
 * POST /api/auth/forgot-password   (throttled, public)
 *
 * Issues a single-use reset link. The response is deliberately identical
 * whether or not the email is registered, so this endpoint can't be used to
 * enumerate customers.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isEmail(email)) {
    throw new AppError("Please enter a valid email address", 400);
  }

  const genericMessage =
    "If an account exists for that email, a reset link is on its way.";

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user || !user.isActive) {
    // Still return the same response — no account enumeration.
    return res.json({ success: true, message: genericMessage });
  }

  // Replace any previous live request for this account.
  await PasswordResetToken.updateMany(
    { user: user._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  const activeCount = await PasswordResetToken.countDocuments({
    user: user._id,
    usedAt: null,
  });

  if (activeCount >= MAX_ACTIVE_REQUESTS_PER_USER) {
    return res.status(429).json({
      success: false,
      message: "Too many reset requests. Please try again later.",
    });
  }

  const rawToken = createRawToken();

  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
  });

  // --- Delivery ---------------------------------------------------
  // No mail provider is wired up yet (that is a later phase), so the link is
  // logged server-side for now. In development it is also returned in the
  // response so the flow is testable end to end.
  //
  // In production this branch is unreachable, so the raw token is never sent
  // to the browser.
  const resetLink = `/reset-password?token=${rawToken}`;

  console.log(
    `[password-reset] link for ${user.email} (valid ${RESET_TTL_MINUTES} min): ${resetLink}`
  );

  if (process.env.NODE_ENV !== "production") {
    return res.json({
      success: true,
      message: genericMessage,
      // Development convenience only.
      devResetToken: rawToken,
      devResetLink: resetLink,
      expiresInMinutes: RESET_TTL_MINUTES,
    });
  }

  return res.json({ success: true, message: genericMessage });
});

/**
 * POST /api/auth/reset-password   (throttled, public)
 *
 * Redeems a token and sets a new password. The token is single-use and is
 * marked consumed before the new hash is written, so a replay fails.
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (typeof token !== "string" || !token.trim()) {
    throw new AppError("Reset token is required", 400);
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters", 400);
  }

  const record = await PasswordResetToken.findOne({
    tokenHash: hashToken(token.trim()),
  });

  // One message for every failure mode, so the response can't be used to
  // probe which tokens exist.
  const invalid = () => {
    throw new AppError("This reset link is invalid or has expired.", 400);
  };

  if (!record) invalid();
  if (record.usedAt) invalid();
  if (record.expiresAt.getTime() < Date.now()) invalid();

  const user = await User.findById(record.user);

  if (!user || !user.isActive) invalid();

  // Burn the token first: if the hashing below fails, the link is spent
  // rather than still usable.
  record.usedAt = new Date();
  await record.save();

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  res.json({
    success: true,
    message: "Your password has been changed. You can now log in.",
  });
});

/**
 * GET /api/auth/reset-password/status?token=...   (throttled, public)
 *
 * Lets the reset page say "this link expired, request a new one" instead of
 * making the customer fill in a new password that will never work.
 */
const checkResetToken = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: "Reset token is required",
    });
  }

  const record = await PasswordResetToken.findOne({
    tokenHash: hashToken(token.trim()),
  });

  const valid = Boolean(
    record && !record.usedAt && record.expiresAt.getTime() >= Date.now()
  );

  return res.json({
    success: true,
    valid,
    expiresAt: record && !record.usedAt ? record.expiresAt : null,
    message: valid
      ? "This reset link is valid."
      : "This reset link is invalid or has expired. Please request a new one.",
  });
});

// --- Saved address book ---

// POST /api/auth/addresses   (protected)
const addAddress = asyncHandler(async (req, res) => {
  const { label, fullName, phone, line1, line2, city, state, pincode, isDefault } = req.body;

  if (!isNonEmptyString(line1)) throw new AppError("Address line 1 is required", 400);
  if (!isNonEmptyString(city)) throw new AppError("City is required", 400);
  if (!isNonEmptyString(state)) throw new AppError("State is required", 400);
  if (phone !== undefined && phone && !isPhone(phone)) {
    throw new AppError("Phone number must be exactly 10 digits", 400);
  }

  const user = req.user;

  if (isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  user.addresses.push({
    label: label || "Address",
    fullName: fullName || user.name,
    phone: phone || user.phone,
    line1: line1.trim(),
    line2: line2 || "",
    city: city.trim(),
    state: state.trim(),
    pincode: pincode || "",
    isDefault: Boolean(isDefault) || user.addresses.length === 0,
  });

  await user.save();

  res.status(201).json({ success: true, message: "Address saved", addresses: user.addresses });
});

// PUT /api/auth/addresses/:addressId   (protected)
const updateAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  const address = user.addresses.id(req.params.addressId);

  if (!address) throw new AppError("Address not found", 404);

  const { label, fullName, phone, line1, line2, city, state, pincode, isDefault } = req.body;

  if (isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  if (label !== undefined) address.label = label;
  if (fullName !== undefined) address.fullName = fullName;
  if (phone !== undefined) address.phone = phone;
  if (line1 !== undefined) address.line1 = line1;
  if (line2 !== undefined) address.line2 = line2;
  if (city !== undefined) address.city = city;
  if (state !== undefined) address.state = state;
  if (pincode !== undefined) address.pincode = pincode;
  if (isDefault !== undefined) address.isDefault = Boolean(isDefault);

  await user.save();

  res.json({ success: true, message: "Address updated", addresses: user.addresses });
});

// DELETE /api/auth/addresses/:addressId   (protected)
const deleteAddress = asyncHandler(async (req, res) => {
  const user = req.user;
  const address = user.addresses.id(req.params.addressId);

  if (!address) throw new AppError("Address not found", 404);

  const wasDefault = address.isDefault;
  user.addresses.pull(req.params.addressId);

  // Never leave the customer with zero default addresses.
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.json({ success: true, message: "Address removed", addresses: user.addresses });
});

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  checkResetToken,
  addAddress,
  updateAddress,
  deleteAddress,
};
