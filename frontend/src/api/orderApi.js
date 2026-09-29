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
  return data; // { order, reviewedProductIds }
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

export const updateOrderStatus = async (id, orderStatus, cancelledReason) => {
  const { data } = await api.put(`/orders/admin/${id}/status`, {
    orderStatus,
    cancelledReason,
  });
  return data.order;
};
