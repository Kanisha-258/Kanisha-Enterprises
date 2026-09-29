import api from "./axios";

export const getBlogs = async (params = {}) => {
  const { data } = await api.get("/blogs", { params });
  return data; // { blogs, total, page, totalPages }
};

export const getBlogTags = async () => {
  const { data } = await api.get("/blogs/tags");
  return data.tags;
};

export const getBlogBySlug = async (slug) => {
  const { data } = await api.get(`/blogs/${slug}`);
  return data; // { blog, related }
};

/* ----------------------------- Admin ----------------------------- */

export const getAdminBlogs = async (params = {}) => {
  const { data } = await api.get("/blogs/admin/all", { params });
  return data;
};

export const createBlog = async (payload) => {
  const { data } = await api.post("/blogs", payload);
  return data.blog;
};

export const updateBlog = async (id, payload) => {
  const { data } = await api.put(`/blogs/${id}`, payload);
  return data.blog;
};

export const deleteBlog = async (id) => {
  const { data } = await api.delete(`/blogs/${id}`);
  return data;
};
