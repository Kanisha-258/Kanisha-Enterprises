import { create } from "zustand";

const TOKEN_KEY = "ke_token";
const USER_KEY = "ke_user";

const loadUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: loadUser(),

  setAuth: (token, user) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable (private mode) — the session still works in memory.
    }
    set({ token, user });
  },

  /** Refreshes just the user, e.g. after a profile edit or a fresh /me call. */
  setUser: (user) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    set({ user });
  },

  clearAuth: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    set({ token: null, user: null });
  },

  isAdmin: () => get().user?.role === "admin",
}));

export const selectIsAdmin = (state) => state.user?.role === "admin";

export default useAuthStore;
