import axios from "axios";
import useAuthStore from "../store/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

// Attach the JWT to every outgoing request.
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Normalises every failure into an Error with a readable `.message`,
 * so components can just do `err.message` instead of digging through
 * `err.response?.data?.message` each time.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      return Promise.reject(
        new Error("The request took too long. Please check your connection.")
      );
    }

    // No response at all — server is down or the URL is wrong.
    if (!error.response) {
      return Promise.reject(
        new Error("Could not reach the server. Please try again in a moment.")
      );
    }

    const { status, data } = error.response;

    // Expired or invalid session: clear it and bounce to login.
    if (status === 401) {
      const { token, clearAuth } = useAuthStore.getState();

      if (token) {
        clearAuth();

        const path = window.location.pathname;
        const isAuthPage = ["/login", "/register"].includes(path);

        if (!isAuthPage) {
          window.location.href = `/login?next=${encodeURIComponent(path)}`;
        }
      }
    }

    const message =
      data?.message ||
      (status === 404
        ? "We couldn't find what you were looking for."
        : status >= 500
          ? "Something went wrong on our end. Please try again."
          : "Request failed. Please try again.");

    const normalised = new Error(message);
    normalised.status = status;
    normalised.data = data;

    return Promise.reject(normalised);
  }
);

export default api;
