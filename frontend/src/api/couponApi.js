import api from "./axios";

/**
 * POST /coupons/validate
 *
 * Prices a cart with an optional code and returns the exact figures the order
 * will be created with. The checkout page renders these directly rather than
 * doing its own arithmetic, so what the customer is shown cannot drift from
 * what they are charged.
 *
 * @param {{productId: string, quantity: number}[]} items
 * @param {string} [couponCode]
 */
export const validateCoupon = async (items, couponCode) => {
  const { data } = await api.post("/coupons/validate", { items, couponCode });
  return data;
  // { success, valid, subtotal, discount, shippingCharge, total,
  //   appliedCoupon, couponReason, message }
};

/** Delivery thresholds, so the cart page doesn't hardcode them. */
export const getCouponConfig = async () => {
  const { data } = await api.get("/coupons/config");
  return data; // { shippingCharge, freeShippingAbove }
};

/* ----------------------------- Admin ----------------------------- */

export const getCoupons = async () => {
  const { data } = await api.get("/admin/coupons");
  return data.coupons;
};

export const createCoupon = async (payload) => {
  const { data } = await api.post("/admin/coupons", payload);
  return data.coupon;
};

/** Edit a coupon, or just toggle isActive to pause it. */
export const updateCoupon = async (id, payload) => {
  const { data } = await api.put(`/admin/coupons/${id}`, payload);
  return data.coupon;
};

export const deleteCoupon = async (id) => {
  const { data } = await api.delete(`/admin/coupons/${id}`);
  return data;
};
