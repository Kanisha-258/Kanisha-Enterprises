import api from "./axios";

export const sendEnquiry = async (payload) => {
  const { data } = await api.post("/enquiries", payload);
  return data;
};

/* ----------------------------- Admin ----------------------------- */

export const getEnquiries = async (params = {}) => {
  const { data } = await api.get("/enquiries/admin/all", { params });
  return data;
};

export const updateEnquiryStatus = async (id, status) => {
  const { data } = await api.put(`/enquiries/admin/${id}/status`, { status });
  return data.enquiry;
};

export const deleteEnquiry = async (id) => {
  const { data } = await api.delete(`/enquiries/admin/${id}`);
  return data;
};
