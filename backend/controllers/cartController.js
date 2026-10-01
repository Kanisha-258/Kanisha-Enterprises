const Cart = require("../models/Cart");
const Product = require("../models/Product");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");

/**
 * The signed-in customer's saved cart.
 *
 * Every handler here works from `req.user._id` and never from a user id in the
 * request, so there is no code path by which one customer can read or change
 * another's basket. The browser's localStorage copy is the fast path; this is
 * the durable copy it syncs with, so a basket follows the customer to another
 * device and survives the tab being closed.
 */

/** Refuse to let a request decide what counts as a product id. */
const readProductId = (value) => {
  const id = String(value ?? "").trim();

  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError("That product could not be found", 400);
  }

  return id;
};

/** Quantities arrive from the network, so they're clamped to sane integers. */
const readQuantity = (value) => {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    throw new AppError("Please choose a valid quantity", 400);
  }

  return Math.max(1, Math.min(Math.floor(quantity), 99));
};

/** Fetches a live product, insisting it is actually on sale. */
const readSellableProduct = async (productId) => {
  const product = await Product.findOne({ _id: productId, isActive: true });

  if (!product) {
    throw new AppError("One or more products are no longer available", 400);
  }

  return product;
};

/**
 * Builds the response the cart page renders from.
 *
 * Prices, names and stock are all read live from the Product collection rather
 * than from the stored cart, which holds only product ids and quantities. That
 * is what stops a cart saved last week from quoting a price that no longer
 * exists.
 *
 * Items whose product has since been deactivated or deleted are reported in
 * `unavailable` so the UI can say so plainly, instead of silently dropping
 * stock out from under the customer without explanation.
 */
const buildCartResponse = async (cart) => {
  const items = cart?.items ?? [];

  if (items.length === 0) {
    return { items: [], count: 0, subtotal: 0, unavailable: [] };
  }

  const products = await Product.find({
    _id: { $in: items.map((i) => i.product) },
    isActive: true,
  });

  const byId = new Map(products.map((p) => [String(p._id), p]));

  const hydrated = [];
  const unavailable = [];

  for (const item of items) {
    const product = byId.get(String(item.product));

    if (!product) {
      unavailable.push({ productId: String(item.product), reason: "unavailable" });
      continue;
    }

    const stock = product.stock;

    // A quantity above what's left is reported rather than rejected: the
    // basket is a placeholder, not a commitment, and the real check happens
    // atomically at checkout. Clamping here too keeps the badge honest.
    const adjusted = item.quantity > stock;

    hydrated.push({
      _id: product._id,
      productId: product._id,
      name: product.name,
      slug: product.slug,
      image: product.image,
      unit: product.unit,
      category: product.category,
      listPrice: product.price,
      // What the customer pays right now, matching Product.effectivePrice.
      price: product.discountPrice > 0 && product.discountPrice < product.price
        ? product.discountPrice
        : product.price,
      quantity: item.quantity,
      stock,
      // True when the basket asks for more than exists, so the cart page can
      // prompt rather than letting checkout be the first place it's noticed.
      adjusted,
    });
  }

  // Same arithmetic the checkout quote uses, so the two can't disagree.
  const subtotal = hydrated.reduce(
    (sum, i) => sum + (i.adjusted ? 0 : i.price * i.quantity),
    0
  );

  return {
    items: hydrated,
    count: hydrated.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    unavailable,
  };
};

/** Loads the caller's cart, or null if they have never saved one. */
const loadCart = (userId) => Cart.findOne({ user: userId });

/**
 * Saves a cart, or deletes it when it becomes empty.
 *
 * An empty cart is removed rather than stored, because the schema forbids an
 * empty `items` array and because there is nothing to remember. The next add
 * simply recreates the document.
 */
const saveOrClear = async (userId, items) => {
  if (items.length === 0) {
    await Cart.deleteOne({ user: userId });
    return null;
  }

  return Cart.findOneAndUpdate(
    { user: userId },
    { $set: { items } },
    { new: true, upsert: true, runValidators: true }
  );
};

// GET /api/cart   (protected)
const getCart = asyncHandler(async (req, res) => {
  const cart = await loadCart(req.user._id);

  res.json({ success: true, ...(await buildCartResponse(cart)) });
});

// POST /api/cart/items   (protected) — add a product, or top up an existing line
const addItem = asyncHandler(async (req, res) => {
  const productId = readProductId(req.body?.productId);
  const quantity = readQuantity(req.body?.quantity ?? 1);
  const product = await readSellableProduct(productId);

  if (product.stock < 1) {
    throw new AppError(`${product.name} is out of stock`, 409);
  }

  const cart = (await loadCart(req.user._id)) || new Cart({ user: req.user._id });
  const existing = cart.items.find((i) => String(i.product) === productId);

  // Clamped to live stock, so a cart can never hold a quantity the shop cannot
  // fulfil. Adding more than is left tops the line up to what's there rather
  // than failing, which is what a customer pressing "add" twice expects.
  const wanted = (existing?.quantity ?? 0) + quantity;

  if (existing) {
    existing.quantity = Math.min(wanted, product.stock);
  } else {
    cart.items.push({ product: productId, quantity: Math.min(quantity, product.stock) });
  }

  const saved = await saveOrClear(req.user._id, cart.items);

  res.json({ success: true, message: "Added to cart", ...(await buildCartResponse(saved)) });
});

// PUT /api/cart/items/:productId   (protected) — set an exact quantity
const updateItem = asyncHandler(async (req, res) => {
  const productId = readProductId(req.params.productId);
  const quantity = readQuantity(req.body?.quantity);
  const product = await readSellableProduct(productId);

  const cart = await loadCart(req.user._id);
  const existing = cart?.items.find((i) => String(i.product) === productId);

  if (!existing) {
    throw new AppError("That product is not in your cart", 404);
  }

  // Same clamp as add: the basket tracks what is actually obtainable.
  existing.quantity = Math.min(quantity, product.stock);

  const saved = await saveOrClear(req.user._id, cart.items);

  res.json({ success: true, ...(await buildCartResponse(saved)) });
});

// DELETE /api/cart/items/:productId   (protected)
const removeItem = asyncHandler(async (req, res) => {
  const productId = readProductId(req.params.productId);
  const cart = await loadCart(req.user._id);

  if (!cart) {
    return res.json({ success: true, items: [], count: 0, subtotal: 0, unavailable: [] });
  }

  const items = cart.items.filter((i) => String(i.product) !== productId);

  if (items.length === cart.items.length) {
    throw new AppError("That product is not in your cart", 404);
  }

  const saved = await saveOrClear(req.user._id, items);

  res.json({ success: true, ...(await buildCartResponse(saved)) });
});

// DELETE /api/cart   (protected) — empty the basket
const clearCart = asyncHandler(async (req, res) => {
  await Cart.deleteOne({ user: req.user._id });

  res.json({ success: true, message: "Cart cleared", items: [], count: 0, subtotal: 0, unavailable: [] });
});

/**
 * PUT /api/cart   (protected) — replace the whole basket
 *
 * This is the endpoint the browser store syncs through: it holds the user's
 * current basket, so the server is told the whole thing rather than a delta.
 *
 * Note the honest trade-off — this is last-write-wins. If the same customer has
 * the site open on a phone and a laptop and adds something on one, the next
 * save from the other overwrites it. That is the right trade for this shop:
 * carts are small, held briefly, and almost never edited on two devices at
 * once, whereas tracking per-device edits would be a lot of machinery to avoid
 * a rare case.
 *
 * Repeated products are summed and quantities clamped to live stock, so the
 * server can only end up holding a basket the customer could have built
 * deliberately. A basket that ends up empty is deleted rather than stored.
 */
const replaceCart = asyncHandler(async (req, res) => {
  const incoming = req.body?.items;

  if (!Array.isArray(incoming)) {
    throw new AppError("Cart items must be a list", 400);
  }

  // Collapse repeats first, so the same product can never be written twice.
  const wanted = new Map();

  for (const item of incoming) {
    const rawId = item?.productId ?? item?.product;
    let productId;

    try {
      productId = readProductId(rawId);
    } catch {
      continue;
    }

    let quantity;

    try {
      quantity = readQuantity(item?.quantity);
    } catch {
      continue;
    }

    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  }

  const items = [];

  if (wanted.size > 0) {
    const products = await Product.find({
      _id: { $in: [...wanted.keys()] },
      isActive: true,
    });

    const stockById = new Map(products.map((p) => [String(p._id), p.stock]));

    for (const [productId, quantity] of wanted) {
      const stock = stockById.get(productId);

      if (!stock || stock < 1) continue;

      items.push({ product: productId, quantity: Math.min(quantity, stock) });
    }
  }

  const saved = await saveOrClear(req.user._id, items);

  res.json({ success: true, ...(await buildCartResponse(saved)) });
});

/**
 * POST /api/cart/merge   (protected)
 *
 * Folds a basket built while signed out into the saved one, and is what makes
 * "add three things, then log in" keep the three things.
 *
 * Quantities are *summed* rather than overwritten, because both carts are real
 * intentions. Anything that would exceed live stock is clamped, and anything
 * no longer for sale is dropped, so a merge can only ever produce a cart the
 * customer could have built themselves.
 */
const mergeCart = asyncHandler(async (req, res) => {
  const incoming = req.body?.items;

  if (!Array.isArray(incoming)) {
    throw new AppError("Cart items must be a list", 400);
  }

  const cart = (await loadCart(req.user._id)) || new Cart({ user: req.user._id });
  const byId = new Map(cart.items.map((i) => [String(i.product), i]));

  const wanted = new Map();

  for (const item of incoming) {
    const rawId = item?.productId ?? item?.product;
    let productId;

    try {
      productId = readProductId(rawId);
    } catch {
      // A junk entry from an old localStorage blob is skipped, not fatal.
      continue;
    }

    let quantity;

    try {
      quantity = readQuantity(item?.quantity);
    } catch {
      continue;
    }

    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  }

  if (wanted.size > 0) {
    const products = await Product.find({
      _id: { $in: [...wanted.keys()] },
      isActive: true,
    });

    const stockById = new Map(products.map((p) => [String(p._id), p.stock]));

    for (const [productId, quantity] of wanted) {
      const stock = stockById.get(productId);

      // Out of stock, or gone from the catalogue: not carried over.
      if (!stock || stock < 1) continue;

      const existing = byId.get(productId);

      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, stock);
      } else {
        cart.items.push({ product: productId, quantity: Math.min(quantity, stock) });
      }
    }
  }

  const saved = await saveOrClear(req.user._id, cart.items);

  res.json({ success: true, message: "Cart synced", ...(await buildCartResponse(saved)) });
});

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  replaceCart,
  mergeCart,
};
