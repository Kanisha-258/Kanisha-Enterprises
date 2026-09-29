import api from "./axios";

export const getStats = async () => {
  const { data } = await api.get("/admin/stats");
  return data; // { stats, statusCounts, recentOrders, topProducts }
};

/* ----------------------------- Users ----------------------------- */

export const getUsers = async (params = {}) => {
  const { data } = await api.get("/admin/users", { params });
  return data;
};

export const updateUser = async (id, payload) => {
  const { data } = await api.put(`/admin/users/${id}`, payload);
  return data.user;
};

// Coupon calls live in ./couponApi alongside the customer-facing
// validateCoupon, so both ends of the feature are in one place.
