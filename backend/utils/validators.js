/**
 * Tiny validation helpers.
 *
 * Each returns true when the value is valid, so routes read as
 * `if (!isEmail(email)) throw new AppError(...)`.
 */

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[0-9]{10}$/;
const PINCODE_RE = /^[0-9]{6}$/;
const COUPON_RE = /^[A-Z0-9]{4,20}$/;

const isEmail = (v) => typeof v === "string" && EMAIL_RE.test(v.trim());
const isPhone = (v) => typeof v === "string" && PHONE_RE.test(v.trim());
const isPincode = (v) => typeof v === "string" && PINCODE_RE.test(v.trim());
const isCouponCode = (v) => typeof v === "string" && COUPON_RE.test(v.trim().toUpperCase());
const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

/** Positive whole number, or a sensible fallback. */
const toPositiveInt = (v, fallback = 1) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Non-negative whole number, or a sensible fallback. */
const toNonNegativeInt = (v, fallback = 0) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Clamp a page number so `?page=-5` can't produce a negative skip. */
const toPage = (v) => toPositiveInt(v, 1);

const toLimit = (v, fallback = 12, max = 100) =>
  Math.min(toPositiveInt(v, fallback), max);

module.exports = {
  isEmail,
  isPhone,
  isPincode,
  isCouponCode,
  isObjectId,
  isNonEmptyString,
  toPositiveInt,
  toNonNegativeInt,
  toPage,
  toLimit,
};
