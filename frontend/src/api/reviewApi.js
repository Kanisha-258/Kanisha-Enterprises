import api from "./axios";

export const getProductReviews = async (productId, params = {}) => {
  const { data } = await api.get(`/reviews/product/${productId}`, { params });
  return data;
};

export const createReview = async (payload) => {
  const { data } = await api.post("/reviews", payload);
  return data.review;
};

export const updateReview = async (id, payload) => {
  const { data } = await api.put(`/reviews/${id}`, payload);
  return data.review;
};

export const deleteReview = async (id) => {
  const { data } = await api.delete(`/reviews/${id}`);
  return data;
};
