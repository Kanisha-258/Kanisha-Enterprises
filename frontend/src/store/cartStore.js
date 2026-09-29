import { create } from "zustand";

const CART_KEY = "ke_cart";
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

const useCartStore = create((set, get) => ({
  // Only the fields needed to render the cart live. Prices are re-checked
  // on the server at checkout, so these are for display only.
  items: read(CART_KEY, []),
  wishlist: read(WISHLIST_KEY, []),

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

    write(CART_KEY, items);
    set({ items });
  },

  updateQuantity: (id, quantity) => {
    const items = get()
      .items.map((i) =>
        i._id === id
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock || 99)) }
          : i
      );

    write(CART_KEY, items);
    set({ items });
  },

  removeItem: (id) => {
    const items = get().items.filter((i) => i._id !== id);
    write(CART_KEY, items);
    set({ items });
  },

  clearCart: () => {
    write(CART_KEY, []);
    set({ items: [] });
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
