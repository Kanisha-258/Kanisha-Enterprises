import { create } from "zustand";

import useAuthStore from "./authStore";
import { getCart, mergeCart, replaceCart } from "../api/cartApi";

/**
 * The cart lives in two places at once.
 *
 * localStorage is the *read* path, so the cart page renders instantly and
 * still works with no connection — which matters on the patchy mobile networks
 * this site's customers use. The server holds a saved copy so a basket follows
 * the customer to another device and survives the tab being closed.
 *
 * The local copy is keyed per user. A single shared key would mean that on a
 * shared or shop-counter browser, whoever signs in next would see the previous
 * person's basket, and — worse — would have it merged into their own on login.
 * Keying by user id makes that impossible: signing out simply stops reading
 * that key.
 */
const GUEST_CART_KEY = "ke_cart_guest";
const userCartKey = (userId) => `ke_cart_user_${userId}`;

/** The pre-Phase-3 key, adopted as the guest cart so no basket is lost. */
const LEGACY_CART_KEY = "ke_cart";
const WISHLIST_KEY = "ke_wishlist";

/**
 * Reads JSON from localStorage without ever throwing.
 * A corrupt value returns the fallback instead of crashing the app.
 */
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private browsing — the cart still works in memory.
  }
};

const remove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

/** Migrates the old single shared key into the per-user layout, once. */
const adoptLegacyCart = () => {
  const legacy = localStorage.getItem(LEGACY_CART_KEY);

  if (legacy === null) return;

  // Only claim it if the guest slot is still free, so a returning customer
  // never has their basket overwritten by a stale legacy value.
  if (localStorage.getItem(GUEST_CART_KEY) === null) {
    localStorage.setItem(GUEST_CART_KEY, legacy);
  }

  remove(LEGACY_CART_KEY);
};

adoptLegacyCart();

/** The storage key for whoever is signed in right now. */
const activeKey = () => {
  const userId = useAuthStore.getState().user?._id;
  return userId ? userCartKey(userId) : GUEST_CART_KEY;
};

const useCartStore = create((set, get) => ({
  // Only the fields needed to render the cart live. Prices are re-checked
  // on the server at checkout, so these are for display only.
  items: read(activeKey(), []),
  wishlist: read(WISHLIST_KEY, []),

  /**
   * "local"     nothing signed in, or nothing to sync
   * "syncing"   a push to the server is in flight
   * "synced"    the server copy matches this one
   * "error"     the last push failed; the local cart is still correct
   *
   * This is surfaced in the UI so a customer is never quietly told their cart
   * is saved when it isn't.
   */
  syncStatus: "local",

  /* ------------------------------ Cart ------------------------------ */

  addItem: (product, quantity = 1) => {
    const items = [...get().items];
    const existing = items.find((i) => i._id === product._id);

    if (existing) {
      const nextQty = Math.min(existing.quantity + quantity, product.stock ?? 99);
      const index = items.findIndex((i) => i._id === product._id);
      items[index] = { ...existing, quantity: nextQty };
    } else {
      items.push({
        _id: product._id,
        name: product.name,
        price: product.effectivePrice ?? product.discountPrice ?? product.price,
        listPrice: product.price,
        image: product.image,
        unit: product.unit,
        category: product.category,
        slug: product.slug,
        stock: product.stock ?? 0,
        quantity: Math.min(quantity, product.stock ?? 99) || 1,
      });
    }

    get()._commit(items);
  },

  updateQuantity: (id, quantity) => {
    const items = get()
      .items.map((i) =>
        i._id === id
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock || 99)) }
          : i
      );

    get()._commit(items);
  },

  removeItem: (id) => {
    const items = get().items.filter((i) => i._id !== id);
    get()._commit(items);
  },

  clearCart: () => {
    get()._commit([]);
  },

  /* --------------------------- Persistence --------------------------- */

  /**
   * The single write path for the cart.
   *
   * Everything that changes the basket funnels through here so there is
   * exactly one place that persists and exactly one place that schedules a
   * server push, rather than each action repeating that logic.
   */
  _commit: (items) => {
    write(activeKey(), items);
    set({ items });
    get()._scheduleSync();
  },

  /**
   * Pushes the whole basket to the server, coalescing bursts.
   *
   * Debounced because the quantity stepper fires a change per click: someone
   * tapping + five times should be one request, not five. The push is
   * last-write-wins by design — see the note on PUT /api/cart.
   */
  _scheduleSync: () => {
    if (!useAuthStore.getState().token) {
      set({ syncStatus: "local" });
      return;
    }

    if (get()._syncTimer) clearTimeout(get()._syncTimer);

    set({ syncStatus: "syncing" });

    get()._syncTimer = setTimeout(() => get()._syncNow(), 600);
  },

  _syncNow: async () => {
    if (!useAuthStore.getState().token) return;

    const items = get().items;
    const key = activeKey();

    try {
      const data = await replaceCart(
        items.map((i) => ({ productId: i._id, quantity: i.quantity }))
      );

      // A sign-out may have happened while the request was in flight. Writing
      // to the key the cart belonged to would be writing to someone else's
      // slot, so this is checked rather than assumed.
      if (activeKey() !== key) return;

      // Trust the server's version: it re-read stock and price, so it can
      // report a clamp the local copy doesn't know about. Persisting it means
      // the clamped value survives a reload, rather than the pre-clamp one
      // being re-pushed on the next change.
      get()._adopt(data.items);
      set({ syncStatus: "synced" });
    } catch {
      // The local cart is already correct, so a failed push is not a failed
      // operation. The next change retries, and the status tells the UI.
      if (activeKey() === key) set({ syncStatus: "error" });
    }
  },

  /**
   * Replaces the cart with the server's version.
   *
   * Used when signing in and after a sync, where the server is authoritative
   * on stock and price. Deliberately does not schedule another push — this is
   * the end of a sync, not a new edit, and re-pushing would loop.
   */
  _adopt: (serverItems = []) => {
    write(activeKey(), serverItems);
    set({ items: serverItems });
  },

  /**
   * Runs whenever the browser becomes a signed-in customer's: folds the guest
   * basket into the saved one, then adopts what the server holds.
   *
   * Merging rather than replacing is the whole point — someone who filled a
   * basket as a guest and then logged in must not silently lose it.
   *
   * The same call covers opening the app with a session already in place,
   * which is what makes a basket changed on another device show up instead of
   * being overwritten by this device's local copy on the next edit. There is
   * no separate hydrate step: a guest basket left over from an earlier visit
   * is a real basket, and merging it on reload is the right outcome, not a
   * surprise.
   */
  syncOnLogin: async () => {
    // The token is the identity that matters. If it changes while the merge is
    // in flight — the user signed out, or the response interceptor found the
    // session expired and cleared it — the answer coming back belongs to
    // somebody else and must be discarded.
    const token = useAuthStore.getState().token;
    if (!token) return;

    const guestItems = read(GUEST_CART_KEY, []);

    try {
      set({ syncStatus: "syncing" });

      // Point this browser at the new user's slot straight away, so a change
      // made while the merge is in flight lands in the right place.
      get()._adopt(read(activeKey(), []));

      const data = guestItems.length
        ? await mergeCart(
            guestItems.map((i) => ({ productId: i._id, quantity: i.quantity }))
          )
        : await getCart();

      if (useAuthStore.getState().token !== token) return;

      get()._adopt(data.items);

      // The guest basket has served its purpose. Leaving it would let the next
      // sign-in on this browser merge the same items in a second time.
      if (guestItems.length) remove(GUEST_CART_KEY);

      set({ syncStatus: "synced" });
    } catch {
      if (useAuthStore.getState().token === token) {
        set({ syncStatus: "error" });
      }
    }
  },

  /**
   * Runs on sign-out, and whenever the signed-in user changes.
   *
   * Switching away from a user's slot is what stops their basket appearing for
   * the next person to use the browser. The server copy is untouched, so
   * signing back in restores it.
   */
  switchUser: () => {
    if (get()._syncTimer) clearTimeout(get()._syncTimer);
    set({ _syncTimer: null, syncStatus: "local" });
    get()._adopt(read(activeKey(), []));
  },

  /* ---------------------------- Wishlist ---------------------------- */

  toggleWishlist: (product) => {
    const wishlist = [...get().wishlist];
    const index = wishlist.findIndex((i) => i._id === product._id);

    if (index >= 0) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push({
        _id: product._id,
        name: product.name,
        price: product.effectivePrice ?? product.price,
        image: product.image,
        unit: product.unit,
        slug: product.slug,
        stock: product.stock ?? 0,
      });
    }

    write(WISHLIST_KEY, wishlist);
    set({ wishlist });
  },

  isWishlisted: (id) => get().wishlist.some((i) => i._id === id),

  clearWishlist: () => {
    write(WISHLIST_KEY, []);
    set({ wishlist: [] });
  },

  // Lets other components react to a change without re-reading the array.
  _cartCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));

// Derived helpers, kept out of the store so they stay pure.
export const selectCartCount = (state) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);

export const selectCartSubtotal = (state) =>
  state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const selectIsWishlisted = (id) => (state) =>
  state.wishlist.some((i) => i._id === id);

export default useCartStore;
