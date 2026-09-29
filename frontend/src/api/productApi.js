import api from "./axios";

// GET /products — { category, subcategory, search, sort, page, limit, minPrice, maxPrice, inStock, featured }
export const getProducts = async (params = {}) => {
  const { data } = await api.get("/products", { params });
  return data; // { success, products, total, page, totalPages }
};

export const getCategories = async () => {
  const { data } = await api.get("/products/categories");
  return data.categories; // [{ name, count, subcategories }]
};

// Works with either a slug or an ObjectId.
export const getProductById = async (idOrSlug) => {
  const { data } = await api.get(`/products/${idOrSlug}`);
  return data; // { product, reviews, related }
};

/* ----------------------------- Admin ----------------------------- */

export const getAdminProducts = async (params = {}) => {
  const { data } = await api.get("/products/admin/all", { params });
  return data;
};

export const createProduct = async (payload) => {
  const { data } = await api.post("/products/admin", payload);
  return data.product;
};

export const updateProduct = async (id, payload) => {
  const { data } = await api.put(`/products/admin/${id}`, payload);
  return data.product;
};

export const deleteProduct = async (id) => {
  const { data } = await api.delete(`/products/admin/${id}`);
  return data;
};
