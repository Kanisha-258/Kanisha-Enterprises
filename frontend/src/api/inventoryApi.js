import api from "./axios";

/* ---------------------------- Suppliers ---------------------------- */

/** List suppliers. Returns { suppliers, total, page, totalPages }. */
export const getSuppliers = async (params = {}) => {
  const { data } = await api.get("/admin/suppliers", { params });
  return data;
};

/** One supplier, with spend stats and recent purchases. */
export const getSupplier = async (id) => {
  const { data } = await api.get(`/admin/suppliers/${id}`);
  return data; // { supplier, stats, purchases }
};

export const createSupplier = async (payload) => {
  const { data } = await api.post("/admin/suppliers", payload);
  return data.supplier;
};

export const updateSupplier = async (id, payload) => {
  const { data } = await api.put(`/admin/suppliers/${id}`, payload);
  return data.supplier;
};

/**
 * Deactivates a supplier.
 *
 * Deactivation is the default because deleting a supplier would orphan every
 * past purchase pointing at them. `hard: true` is only accepted for a supplier
 * with no purchase history; the API refuses it otherwise.
 */
export const deleteSupplier = async (id, { hard = false } = {}) => {
  const { data } = await api.delete(`/admin/suppliers/${id}`, {
    params: hard ? { hard: "true" } : undefined,
  });
  return data;
};

/* ---------------------------- Purchases ---------------------------- */

export const getPurchases = async (params = {}) => {
  const { data } = await api.get("/admin/purchases", { params });
  return data;
};

export const getPurchase = async (id) => {
  const { data } = await api.get(`/admin/purchases/${id}`);
  return data.purchase;
};

export const getPurchaseSummary = async () => {
  const { data } = await api.get("/admin/purchases/summary");
  return data.stats;
};

/** Creates a draft. Stock is not added until the purchase is received. */
export const createPurchase = async (payload) => {
  const { data } = await api.post("/admin/purchases", payload);
  return data.purchase;
};

export const updatePurchase = async (id, payload) => {
  const { data } = await api.put(`/admin/purchases/${id}`, payload);
  return data.purchase;
};

/** Adds stock for every line. Safe to call twice: the second call is rejected. */
export const receivePurchase = async (id) => {
  const { data } = await api.post(`/admin/purchases/${id}/receive`);
  return data;
};

export const cancelPurchase = async (id, reason) => {
  const { data } = await api.put(`/admin/purchases/${id}/cancel`, { reason });
  return data;
};

export const deletePurchase = async (id) => {
  const { data } = await api.delete(`/admin/purchases/${id}`);
  return data;
};

/* ---------------------------- Inventory ---------------------------- */

/**
 * Stock levels for every product, with average cost and last movement.
 *
 * `stock` filter accepts "low", "out" or "all".
 */
export const getInventory = async (params = {}) => {
  const { data } = await api.get("/admin/inventory", { params });
  return data;
};

export const getInventorySummary = async () => {
  const { data } = await api.get("/admin/inventory/summary");
  return data.stats;
};

/** One product's movements, newest first. */
export const getProductHistory = async (productId, params = {}) => {
  const { data } = await api.get(`/admin/inventory/${productId}`, { params });
  return data;
};

/** The cross-product movement feed, filterable by type. */
export const getMovements = async (params = {}) => {
  const { data } = await api.get("/admin/inventory/movements", { params });
  return data;
};

/**
 * Manual stock correction.
 *
 * `reason` is required by the server — this is the only record of why the
 * number changed, so there is no sensible default.
 */
export const adjustStock = async (productId, { direction, quantity, reason }) => {
  const { data } = await api.post(`/admin/inventory/${productId}/adjust`, {
    direction,
    quantity,
    reason,
  });
  return data;
};
