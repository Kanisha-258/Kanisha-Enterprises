import api from "./axios";

export const placeOrder = async (payload) => {
  const { data } = await api.post("/orders", payload);
  return data.order;
};

export const getMyOrders = async (params = {}) => {
  const { data } = await api.get("/orders", { params });
  return data;
};

export const getOrderById = async (id) => {
  const { data } = await api.get(`/orders/${id}`);
  return data; // { order, reviewedProductIds, canCancel, cancelBlockedReason,
  //               availableTransitions }
};

export const cancelOrder = async (id, reason) => {
  const { data } = await api.put(`/orders/${id}/cancel`, { reason });
  return data.order;
};

/* ----------------------------- Admin ----------------------------- */

export const getAllOrders = async (params = {}) => {
  const { data } = await api.get("/orders/admin/all", { params });
  return data;
};

/**
 * Move an order to a new status.
 *
 * `note` is stored on the status-history entry, so it is the right place for
 * "customer called, will pay on delivery" rather than something only the admin
 * can see. The old third argument, a cancellation reason, is still accepted so
 * existing callers do not break; it lands in the same field.
 */
export const updateOrderStatus = async (id, orderStatus, cancelledReason) => {
  const { data } = await api.put(`/orders/admin/${id}/status`, {
    orderStatus,
    note: cancelledReason,
  });
  return data.order;
};

/**
 * Record what actually happened to the money on a cash order.
 *
 * Only meaningful for COD: the API refuses online payments, because only
 * Razorpay's own verification can say whether those settled.
 */
export const updatePaymentStatus = async (id, paymentStatus, note) => {
  const { data } = await api.put(`/orders/admin/${id}/payment`, {
    paymentStatus,
    note,
  });
  return data.order;
};
