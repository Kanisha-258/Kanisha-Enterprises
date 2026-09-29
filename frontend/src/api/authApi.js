import api from "./axios";

/* ------------------------------ Auth ------------------------------ */

export const register = async (payload) => {
  const { data } = await api.post("/auth/register", payload);
  return data; // { token, user }
};

export const login = async (payload) => {
  const { data } = await api.post("/auth/login", payload);
  return data;
};

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data.user;
};

export const updateProfile = async (payload) => {
  const { data } = await api.put("/auth/me", payload);
  return data.user;
};

export const changePassword = async (payload) => {
  const { data } = await api.put("/auth/password", payload);
  return data;
};

/* -------------------------- Password reset -------------------------- */

/**
 * Requests a reset link.
 *
 * The response is deliberately identical whether or not the email is
 * registered, so this can't be used to discover customer accounts. In
 * development the backend also returns devResetLink so the flow can be tested
 * without a mail provider; that field is absent in production.
 */
export const forgotPassword = async (email) => {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
};

/** Checks whether a reset token is still usable, so the page can warn early. */
export const checkResetToken = async (token) => {
  const { data } = await api.get("/auth/reset-password/status", {
    params: { token },
  });
  return data;
};

/** Redeems a token and sets the new password. */
export const resetPassword = async (token, newPassword) => {
  const { data } = await api.post("/auth/reset-password", { token, newPassword });
  return data;
};

/* --------------------------- Addresses --------------------------- */

export const addAddress = async (payload) => {
  const { data } = await api.post("/auth/addresses", payload);
  return data.addresses;
};

export const updateAddress = async (id, payload) => {
  const { data } = await api.put(`/auth/addresses/${id}`, payload);
  return data.addresses;
};

export const deleteAddress = async (id) => {
  const { data } = await api.delete(`/auth/addresses/${id}`);
  return data.addresses;
};
