const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const AppError = require("./AppError");
const { isCouponCode } = require("./validators");
const { applyStockChanges } = require("./inventory");

// Business rules, overridable from .env
const SHIPPING_CHARGE = Number(process.env.SHIPPING_CHARGE ?? 49);
const FREE_SHIPPING_ABOVE = Number(process.env.FREE_SHIPPING_ABOVE ?? 999);

/**
 * Turns the client's cart into priced order items using database values.
 *
 * The client only ever says "this product, this many". Everything that
 * affects money — unit price, discount, stock, availability — is read
 * from the database here, so a tampered request can't change a total.
 */
const buildOrderItems = async (cartItems) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new AppError("Your cart is empty", 400);
  }

  const ids = cartItems.map((i) => i.productId || i.product);
  const uniqueIds = [...new Set(ids.map(String))];

  if (uniqueIds.length !== ids.length) {
    throw new AppError("The same product was added twice", 400);
  }

  const products = await Product.find({ _id: { $in: uniqueIds }, isActive: true });

  if (products.length !== uniqueIds.length) {
    throw new AppError("One or more products are no longer available", 400);
  }

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  return cartItems.map((item) => {
    const product = productMap.get(String(item.productId || item.product));

    if (!product) {
      throw new AppError("One or more products are no longer available", 400);
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

    if (product.stock < quantity) {
      throw new AppError(
        `Only ${product.stock} unit(s) of "${product.name}" are in stock`,
        400
      );
    }

    return {
      product: product._id,
      name: product.name,
      image: product.image,
      unit: product.unit,
      price:
        product.discountPrice > 0 && product.discountPrice < product.price
          ? product.discountPrice
          : product.price,
      quantity,
    };
  });
};

/**
 * Works out the discount for a coupon against the given items.
 *
 * Returns { discount, coupon, reason }:
 *   - discount: rupees off (0 when the code doesn't apply)
 *   - coupon:   the coupon document, or null
 *   - reason:   machine-readable failure code, or null on success
 *
 * `reason` is additive — existing callers only destructure { discount, coupon },
 * so this stays backward compatible. The checkout page uses it to explain *why*
 * a code was rejected instead of guessing.
 */
const calculateDiscount = async (code, subtotal, items) => {
  const rejected = (reason) => ({ discount: 0, coupon: null, reason });

  if (!code || !String(code).trim()) return rejected("no_code");
  if (!isCouponCode(code)) return rejected("malformed");

  const coupon = await Coupon.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
  });

  if (!coupon) return rejected("not_found");

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) return rejected("not_started");
  if (coupon.validUntil && coupon.validUntil < now) return rejected("expired");

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return rejected("usage_limit_reached");
  }

  if (subtotal < coupon.minOrderValue) return rejected("min_order_not_met");

  // Category-restricted coupons only discount the matching items.
  const eligibleSubtotal = coupon.appliesTo.length
    ? items
        .filter((i) => coupon.appliesTo.includes(i.product.category))
        .reduce((sum, i) => sum + i.price * i.quantity, 0)
    : subtotal;

  if (eligibleSubtotal <= 0) return rejected("no_eligible_items");

  let discount =
    coupon.type === "percentage"
      ? (eligibleSubtotal * coupon.value) / 100
      : coupon.value;

  if (coupon.type === "percentage" && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

  // Never discount more than the order is worth.
  discount = Math.min(Math.round(discount), subtotal);

  return { discount, coupon, reason: null };
};

/** Puts subtotal, discount, shipping and total together. */
const priceOrder = (items, discount = 0) => {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Clamp defensively: a discount can never exceed the order value, so the
  // total can never go negative even if a caller passes a bad discount.
  // The isFinite check stops NaN from propagating through the maths.
  const requested = Number(discount);
  const appliedDiscount = Number.isFinite(requested)
    ? Math.max(0, Math.min(Math.round(requested), subtotal))
    : 0;
  const afterDiscount = subtotal - appliedDiscount;
  const shippingCharge = afterDiscount >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_CHARGE;

  return {
    subtotal,
    discount: appliedDiscount,
    shippingCharge,
    total: afterDiscount + shippingCharge,
  };
};

/** Checks the shipping address is complete enough to deliver to. */
const validateAddress = (shippingAddress = {}) => {
  const { fullName, phone, line1, city, state } = shippingAddress;

  if (!fullName || !String(fullName).trim()) {
    throw new AppError("Delivery name is required", 400);
  }
  if (!/^[0-9]{10}$/.test(String(phone || "").trim())) {
    throw new AppError("A valid 10-digit phone number is required", 400);
  }
  if (!line1 || !String(line1).trim()) throw new AppError("Address line 1 is required", 400);
  if (!city || !String(city).trim()) throw new AppError("City is required", 400);
  if (!state || !String(state).trim()) throw new AppError("State is required", 400);

  return {
    fullName: String(fullName).trim(),
    phone: String(phone).trim(),
    line1: String(line1).trim(),
    line2: shippingAddress.line2 || "",
    city: String(city).trim(),
    state: String(state).trim(),
    pincode: shippingAddress.pincode || "",
  };
};

/**
 * Decrements stock for each item, recording a SALE movement for each.
 *
 * Routed through applyStockChange so an order is a first-class entry in the
 * stock ledger, and so the "not enough stock" check is the same atomic
 * operation everywhere rather than a separate pre-check that could race.
 */
const reserveStock = (items, { orderId, performedBy } = {}) =>
  applyStockChanges(
    items.map((item) => ({
      productId: item.product,
      productName: item.name,
      quantity: item.quantity,
      direction: -1,
      type: "SALE",
      referenceType: "order",
      referenceId: orderId || null,
      performedBy: performedBy || null,
      reason: "Sold to a customer",
    })),
    // A failed order must not leave half its items deducted.
    true
  );

/**
 * Returns stock to the shelf, recording a SALE_CANCEL movement for each.
 *
 * `rollbackOnFailure` is off here on purpose. A cancellation is a series of
 * independent corrections: if one product can't be restored, the others should
 * still be, and the failure should be reported rather than silently undoing
 * the restorations that did succeed.
 */
const releaseStock = (items, { orderId, performedBy, reason } = {}) =>
  applyStockChanges(
    items.map((item) => ({
      productId: item.product,
      productName: item.name,
      quantity: item.quantity,
      direction: 1,
      type: "SALE_CANCEL",
      referenceType: "order",
      referenceId: orderId || null,
      performedBy: performedBy || null,
      reason: reason || "Returned to stock",
    })),
    false
  );

/**
 * The single source of truth for "what will this order cost".
 *
 * Both the order-placement controllers and the checkout preview endpoint call
 * this, so the total a customer is shown before paying comes from exactly the
 * same arithmetic that charges them. Nothing is re-derived on the client.
 *
 * Does NOT reserve stock, so it is safe to call repeatedly.
 */
const quoteOrder = async (cartItems, couponCode) => {
  const items = await buildOrderItems(cartItems);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const { discount, coupon, reason } = await calculateDiscount(
    couponCode,
    subtotal,
    items
  );

  const totals = priceOrder(items, discount);

  return {
    ...totals,
    // Priced line items, so callers don't price the cart a second time.
    items,
    appliedCoupon: coupon
      ? {
          // _id is included so callers can increment usage without re-querying.
          _id: coupon._id,
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          maxDiscount: coupon.maxDiscount,
          minOrderValue: coupon.minOrderValue,
        }
      : null,
    // Why the coupon was rejected, or null when it applied.
    couponReason: reason,
  };
};

module.exports = {
  buildOrderItems,
  calculateDiscount,
  priceOrder,
  quoteOrder,
  validateAddress,
  reserveStock,
  releaseStock,
  SHIPPING_CHARGE,
  FREE_SHIPPING_ABOVE,
};
