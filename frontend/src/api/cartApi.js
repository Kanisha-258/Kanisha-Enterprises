import api from "./axios";

/**
 * The signed-in customer's saved cart.
 *
 * The browser's localStorage copy is what the UI reads, so this is a
 * synchronisation layer rather than the source of truth: the store writes
 * locally first (so the cart stays instant and works offline) and pushes the
 * change here in the background. The server re-prices everything on read, so a
 * cart left open for a week can never quote a stale price.
 */

export const getCart = async () => {
  const { data } = await api.get("/cart");
  return data; // { items, count, subtotal, unavailable }
};

/**
 * Replaces the whole basket with what the browser currently holds.
 *
 * The store keeps the current basket, so it sends the whole thing rather than
 * a delta. That keeps a burst of quantity changes to one request, and it means
 * a retry can't apply the same increment twice.
 *
 * Last-write-wins by design — see the note on the server handler.
 */
export const replaceCart = async (items) => {
  const { data } = await api.put("/cart", { items });
  return data;
};

/**
 * Folds a cart built while signed out into the signed-in one.
 *
 * Called once, on sign-in, so that adding things as a guest and then logging
 * in keeps those things rather than silently dropping them.
 */
export const mergeCart = async (items) => {
  const { data } = await api.post("/cart/merge", { items });
  return data;
};
