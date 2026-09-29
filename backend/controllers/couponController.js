const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const { quoteOrder } = require("../utils/orderHelpers");

/**
 * Human-readable text for each rejection reason.
 *
 * Kept next to the endpoint (not in the client) so the explanation a customer
 * sees is defined once, on the server, next to the rule that rejected them.
 */
const REASON_MESSAGES = {
  no_code: "Enter a discount code.",
  malformed: "That discount code doesn't look right. Use 4-20 letters or numbers.",
  not_found: "That discount code doesn't exist.",
  not_started: "That discount isn't active yet.",
  expired: "That discount has expired.",
  usage_limit_reached: "That discount has been fully claimed.",
  min_order_not_met: "Your order doesn't meet the minimum value for this discount.",
  no_eligible_items: "This discount doesn't apply to anything in your cart.",
};

/**
 * POST /api/coupons/validate   (protected)
 *
 * Prices a cart with an optional coupon and returns the exact figures the
 * order will be created with. The checkout page calls this so the discount and
 * total it displays can never disagree with what is ultimately charged.
 *
 * Body: { items: [{ productId, quantity }], couponCode?: string }
 *
 * This is a quote, not a booking: it reserves no stock and does not increment
 * coupon usage. A coupon could still be exhausted by someone else before the
 * customer submits, which the order endpoint will then reject.
 */
const validateCoupon = asyncHandler(async (req, res) => {
  const { items, couponCode } = req.body;

  const quote = await quoteOrder(items, couponCode);

  // `items` is included in the quote so order creation can reuse it; the
  // client doesn't need it echoed back here.
  const { couponReason, appliedCoupon, items: _lineItems, ...totals } = quote;

  // "No code supplied" is not a rejected coupon — it's just an ordinary cart.
  // Only report valid:false when a code was actually given and refused.
  const noCodeGiven = couponReason === "no_code";

  res.json({
    success: true,

    // Always 200: an unusable code is a normal answer, not a server error.
    valid: noCodeGiven || couponReason === null,
    ...totals,
    appliedCoupon,
    couponReason: noCodeGiven ? null : couponReason,
    message: couponReason && !noCodeGiven ? REASON_MESSAGES[couponReason] : null,
  });
});

/**
 * GET /api/coupons/config   (public)
 *
 * Lets the cart page show the delivery threshold the server actually uses,
 * rather than duplicating SHIPPING_CHARGE / FREE_SHIPPING_ABOVE in the
 * frontend where the two copies can drift apart.
 */
const getConfig = asyncHandler(async (req, res) => {
  const { SHIPPING_CHARGE, FREE_SHIPPING_ABOVE } = require("../utils/orderHelpers");

  res.json({
    success: true,
    shippingCharge: SHIPPING_CHARGE,
    freeShippingAbove: FREE_SHIPPING_ABOVE,
  });
});

module.exports = { validateCoupon, getConfig, REASON_MESSAGES };
