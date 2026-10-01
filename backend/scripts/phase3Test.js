/**
 * Phase 3 tests: the customer/dealer purchasing flow end to end.
 *
 *   1. start the server:  npm run dev
 *   2. run this:          npm run test:phase3
 *
 * Covers cart handling, checkout validation, order creation, stock deduction
 * through the inventory ledger, customer/dealer isolation, admin order
 * management, and the guards against a duplicate order.
 *
 * Every account it creates uses an @test.com address, which `npm run db:clean`
 * already recognises, and its stock normalisation goes through the inventory
 * API as a recorded MANUAL_ADJUSTMENT rather than a direct database write — so
 * the ledger stays honest and the cleanup script can recognise the rows.
 */
const BASE = process.env.API_URL || "http://localhost:5000/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "owner@kanisha.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "AdminTest123";

let passed = 0;
let failed = 0;

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
};

/**
 * Readers for a cart response that never throw.
 *
 * A check that crashed on a missing field would abort the run and hide every
 * result after it. These turn an unexpected response into a failed check, so
 * the rest of the suite still runs and the totals stay honest.
 */
const cartItems = (res) => (Array.isArray(res?.data?.items) ? res.data.items : []);
const cartQty = (res, productId) =>
  cartItems(res).find((i) => String(i._id) === String(productId))?.quantity;
const cartSubtotal = (res) => (typeof res?.data?.subtotal === "number" ? res.data.subtotal : NaN);

const section = (t) => console.log(`\n${t}`);

let skipped = 0;

const skip = (name, reason) => {
  skipped++;
  console.log(`  SKIP  ${name} (${reason})`);
};

/**
 * Order placement is rate limited to 10/minute per IP, and this suite is the
 * one that places the most orders, so it exhausts that budget on its own.
 *
 * A 429 is the limiter working, not a broken endpoint, so it is reported as a
 * skip. But silently skipping would let a real failure hide behind it, so every
 * order check goes through `placeOrder` below, which waits for the window to
 * reset once and then re-tries — turning a skip into an actual result wherever
 * it can.
 */
const waitOutRateLimit = async (res) => {
  if (res.status !== 429) return res;

  const retryAfter = Number(res.data?.retryAfter) || 60;
  console.log(`  (rate limited — waiting ${retryAfter}s)`);
  await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));

  return null;
};

/**
 * Calls POST /orders, waiting out the rate limiter if that is the reason for a
 * 429. This is the only route the limiter guards that the suite leans on, so
 * every order placement goes through here rather than calling `call` directly.
 */
const placeOrder = async (body, token) => {
  const first = await call("POST", "/orders", { body, token });

  if (first.status !== 429) return first;

  return (await waitOutRateLimit(first)) || (await call("POST", "/orders", { body, token }));
};

/**
 * Calls POST /orders expecting it to be refused, waiting out the rate limiter
 * in the same way.
 *
 * Safe to retry even when the outcome is unknown, because these requests are
 * all supposed to be rejected — re-sending one cannot create an order. That is
 * what lets the validation and stock-guard checks run after the real placements
 * have used up the minute's budget, instead of being reported as inconclusive.
 */
const refuseOrder = async (body, token) => {
  const first = await call("POST", "/orders", { body, token });

  if (first.status !== 429) return first;

  return (await waitOutRateLimit(first)) || (await call("POST", "/orders", { body, token }));
};

const stamp = Date.now();

const ADDRESS = {
  fullName: "Phase Three Tester",
  phone: "9876543210",
  line1: "12 Test Road",
  city: "Nashik",
  state: "Maharashtra",
  pincode: "422001",
};

/** Registers a throwaway account of the given type. */
const register = async (label, userType) =>
  call("POST", "/auth/register", {
    body: {
      name: `Phase3 ${label}`,
      email: `phase3${label}${stamp}@test.com`,
      phone: `9${String(Math.abs(hash(label)) % 1000000000).padStart(9, "0")}`,
      password: "PhaseThree123",
      userType,
    },
  });

/** Small stable hash, so a label always yields the same valid 10-digit phone. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Puts a product's stock back to a known value through the inventory API, so
 * assertions about exact numbers don't depend on what other suites did to the
 * catalogue. Recorded as a MANUAL_ADJUSTMENT, which db:clean recognises.
 */
const setStock = async (token, productId, stock) => {
  const current = (await call("GET", `/products/${productId}`)).data.product?.stock ?? 0;
  const delta = stock - current;

  if (delta === 0) return;

  await call("POST", `/admin/inventory/${productId}/adjust`, {
    token,
    body: {
      direction: delta > 0 ? "add" : "remove",
      quantity: Math.abs(delta),
      reason: "Phase 3 test: normalising stock before assertions",
    },
  });
};

const run = async () => {
  console.log(`Phase 3 tests against ${BASE}\n${"=".repeat(52)}`);

  // -------------------------------------------------------------------
  section("Setup");

  const login = await call("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  check("admin signs in", login.status === 200 && !!login.data.token);

  const token = login.data.token;

  const products = (await call("GET", "/products?limit=100")).data.products || [];
  check("found products to work with", products.length >= 3, `got ${products.length}`);

  // The roomiest products, so this suite doesn't depend on what earlier suites
  // did to stock levels.
  const roomiest = [...products].sort((a, b) => b.stock - a.stock).slice(0, 3);
  const [productA, productB] = roomiest;
  const aId = String(productA._id);
  const bId = String(productB._id);

  await setStock(token, aId, 40);
  await setStock(token, bId, 25);

  const freshA = (await call("GET", `/products/${aId}`)).data.product;
  const freshB = (await call("GET", `/products/${bId}`)).data.product;
  check("stock normalised to a known value", freshA.stock === 40 && freshB.stock === 25,
    `A=${freshA.stock} B=${freshB.stock}`);

  // The unit price the server will charge, taken from the product list.
  const priceA = freshA.effectivePrice ?? freshA.price;
  const priceB = freshB.effectivePrice ?? freshB.price;

  // -------------------------------------------------------------------
  section("Account types");

  const cust = await register("customer", "customer");
  check("customer registers", cust.status === 201 && !!cust.data.token);
  const custToken = cust.data.token;

  const dealer = await register("dealer", "dealer");
  check("dealer registers", dealer.status === 201 && !!dealer.data.token);
  const dealerToken = dealer.data.token;

  check("customer is userType=customer", cust.data.user?.userType === "customer",
    String(cust.data.user?.userType));
  check("dealer is userType=dealer", dealer.data.user?.userType === "dealer",
    String(dealer.data.user?.userType));
  check("neither registration granted admin", cust.data.user?.role === "user"
    && dealer.data.user?.role === "user");

  const badType = await call("POST", "/auth/register", {
    body: {
      name: "Phase3 Bad Type",
      email: `phase3badtype${stamp}@test.com`,
      phone: "9000001111",
      password: "PhaseThree123",
      userType: "admin",
    },
  });
  check("a userType of 'admin' is rejected", badType.status === 400, `status ${badType.status}`);

  const escalate = await call("POST", "/auth/register", {
    body: {
      name: "Phase3 Escalate",
      email: `phase3escalate${stamp}@test.com`,
      phone: "9000002222",
      password: "PhaseThree123",
      role: "admin",
    },
  });
  check("role in the body cannot make an admin", escalate.data.user?.role === "user");

  const flip = await call("PUT", "/auth/me", {
    token: custToken,
    body: { userType: "dealer" },
  });
  check("a customer can relabel themselves a dealer", flip.data.user?.userType === "dealer");
  await call("PUT", "/auth/me", { token: custToken, body: { userType: "customer" } });

  // -------------------------------------------------------------------
  section("Cart authorization");

  check("GET /cart needs a token", (await call("GET", "/cart")).status === 401);
  check("POST /cart/items needs a token", (await call("POST", "/cart/items",
    { body: { productId: aId } })).status === 401);
  check("PUT /cart needs a token", (await call("PUT", "/cart",
    { body: { items: [] } })).status === 401);
  check("DELETE /cart needs a token", (await call("DELETE", "/cart")).status === 401);
  check("POST /cart/merge needs a token", (await call("POST", "/cart/merge",
    { body: { items: [] } })).status === 401);

  // -------------------------------------------------------------------
  section("Cart add, change, remove");

  const emptyCart = await call("GET", "/cart", { token: custToken });
  check("a new cart starts empty",
    emptyCart.status === 200 && cartItems(emptyCart).length === 0);

  const added = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: aId, quantity: 2 },
  });
  check("add to cart", added.status === 200 && cartItems(added).length === 1,
    `status ${added.status}`);
  check("add stores the quantity asked for",
    cartQty(added, aId) === 2, `got ${cartQty(added, aId)}`);
  check("cart subtotal is price x quantity",
    cartSubtotal(added) === priceA * 2, `${cartSubtotal(added)} vs ${priceA * 2}`);

  // Adding the same product again tops the existing line up rather than
  // creating a second one.
  const toppedUp = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: aId, quantity: 3 },
  });
  check("adding again tops up the same line",
    cartItems(toppedUp).length === 1 && cartQty(toppedUp, aId) === 5,
    `${cartItems(toppedUp).length} lines, qty ${cartQty(toppedUp, aId)}`);

  const second = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: bId, quantity: 1 },
  });
  check("a second product is a second line", cartItems(second).length === 2);
  check("count sums quantities", second.data?.count === 6, String(second.data?.count));

  const increased = await call("PUT", `/cart/items/${aId}`, {
    token: custToken,
    body: { quantity: 8 },
  });
  check("quantity can be set", cartQty(increased, aId) === 8, `got ${cartQty(increased, aId)}`);

  const decreased = await call("PUT", `/cart/items/${aId}`, {
    token: custToken,
    body: { quantity: 2 },
  });
  check("quantity can be lowered", cartQty(decreased, aId) === 2, `got ${cartQty(decreased, aId)}`);

  const floored = await call("PUT", `/cart/items/${aId}`, {
    token: custToken,
    body: { quantity: 0 },
  });
  check("quantity of 0 is raised to 1, not accepted as 0",
    cartQty(floored, aId) === 1, `got ${cartQty(floored, aId)}`);

  const removed = await call("DELETE", `/cart/items/${bId}`, { token: custToken });
  check("remove one item", cartItems(removed).length === 1);

  const removeMissing = await call("DELETE", `/cart/items/${bId}`, { token: custToken });
  check("removing an item that isn't there is a 404", removeMissing.status === 404);

  const cleared = await call("DELETE", "/cart", { token: custToken });
  check("clear cart", cleared.status === 200 && cartItems(cleared).length === 0);

  // -------------------------------------------------------------------
  section("Cart quantity and stock guards");

  await setStock(token, aId, 5);

  // Seed the line first: the update endpoint deliberately 404s on a product
  // that isn't in the cart, so the "more than the stock on hand" rule has to be
  // tested on a line that exists.
  await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: aId, quantity: 1 },
  });

  const overStock = await call("PUT", `/cart/items/${aId}`, {
    token: custToken,
    body: { quantity: 99 },
  });
  check("cannot raise a line above the stock on hand",
    cartQty(overStock, aId) === 5,
    `status ${overStock.status}, got ${cartQty(overStock, aId)}`);
  await call("DELETE", "/cart", { token: custToken });

  await setStock(token, aId, 0);
  const outOfStock = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: aId, quantity: 1 },
  });
  check("an out-of-stock product is refused", outOfStock.status === 409,
    `status ${outOfStock.status}`);
  await setStock(token, aId, 40);

  const badId = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: "not-an-id" },
  });
  check("a malformed product id is refused", badId.status === 400);

  const negative = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: aId, quantity: -5 },
  });
  check("a negative quantity is raised to 1, not accepted",
    negative.status === 200 && cartQty(negative, aId) === 1,
    `status ${negative.status}, got ${cartQty(negative, aId)}`);

  const notSellable = await call("POST", "/cart/items", {
    token: custToken,
    body: { productId: "000000000000000000000000", quantity: 1 },
  });
  check("an unknown product is refused", notSellable.status === 400);

  await call("DELETE", "/cart", { token: custToken });

  // -------------------------------------------------------------------
  section("Cart survives a new session");

  await call("PUT", "/cart", {
    token: custToken,
    body: { items: [{ productId: aId, quantity: 3 }] },
  });

  // A brand new token for the same account is what a different device looks
  // like. The saved cart is per user, not per token.
  const custLogin = await call("POST", "/auth/login", {
    body: { email: `phase3customer${stamp}@test.com`, password: "PhaseThree123" },
  });
  check("customer can sign in again", custLogin.status === 200);

  const reloaded = await call("GET", "/cart", { token: custLogin.data.token });
  check("the cart is still there in a new session",
    cartItems(reloaded).length === 1 && cartQty(reloaded, aId) === 3,
    `${cartItems(reloaded).length} lines, qty ${cartQty(reloaded, aId)}`);

  // -------------------------------------------------------------------
  section("Guest cart merges on sign-in");

  // The saved cart holds 3 of A at this point; merging a guest basket with 2
  // more of A must sum them rather than overwrite.
  const guestMerge = await call("POST", "/cart/merge", {
    token: custToken,
    body: { items: [{ productId: aId, quantity: 2 }, { productId: bId, quantity: 1 }] },
  });
  check("merging a guest cart adds to the saved one",
    cartItems(guestMerge).length === 2, `${cartItems(guestMerge).length} lines`);
  check("merging sums the quantities of a product already present",
    cartQty(guestMerge, aId) === 5, `3 saved + 2 guest should be 5, got ${cartQty(guestMerge, aId)}`);
  check("merging brings in a product that was not saved",
    cartQty(guestMerge, bId) === 1, `got ${cartQty(guestMerge, bId)}`);

  const junkMerge = await call("POST", "/cart/merge", {
    token: custToken,
    body: { items: [{ productId: "garbage", quantity: -1 }, null, { productId: bId, quantity: 2 }] },
  });
  check("junk entries in a merge are skipped, not fatal", junkMerge.status === 200);

  const notArray = await call("POST", "/cart/merge", {
    token: custToken,
    body: { items: "nope" },
  });
  check("merge rejects a non-list", notArray.status === 400);

  await call("DELETE", "/cart", { token: custToken });

  // -------------------------------------------------------------------
  section("Cart isolation");

  await call("PUT", "/cart", {
    token: custToken,
    body: { items: [{ productId: aId, quantity: 4 }] },
  });

  const dealerCart = await call("GET", "/cart", { token: dealerToken });
  check("a dealer does not see the customer's cart", cartItems(dealerCart).length === 0,
    `${cartItems(dealerCart).length} lines`);

  const dealerWrites = await call("PUT", "/cart", {
    token: dealerToken,
    body: { items: [{ productId: bId, quantity: 1 }] },
  });
  check("a dealer has their own cart", cartItems(dealerWrites).length === 1);

  const custStillMine = await call("GET", "/cart", { token: custToken });
  check("the customer's cart is untouched by the dealer's write",
    cartItems(custStillMine).length === 1 && cartQty(custStillMine, aId) === 4,
    `${cartItems(custStillMine).length} lines, qty ${cartQty(custStillMine, aId)}`);

  // A customer cannot reach another cart by guessing an id, because every
  // route works from the session rather than a parameter.
  const viaQuery = await call("GET", "/cart?userId=abc", { token: dealerToken });
  check("a cart route ignores a userId in the query string",
    cartItems(viaQuery).length === 1 && cartQty(viaQuery, bId) === 1,
    `${cartItems(viaQuery).length} lines`);

  // -------------------------------------------------------------------
  section("Cart prices are the server's, not the client's");

  const priced = await call("GET", "/cart", { token: custToken });
  check("cart price matches the live product price",
    cartItems(priced)[0]?.price === priceA,
    `${cartItems(priced)[0]?.price} vs ${priceA}`);

  // -------------------------------------------------------------------
  section("Checkout validation");

  const noItems = await refuseOrder(
    { items: [], shippingAddress: ADDRESS, paymentMethod: "cod" },
    custToken
  );
  check("an empty order is refused", noItems.status === 400, `status ${noItems.status}`);

  const noAddress = await refuseOrder(
    {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: { fullName: "No Address" },
      paymentMethod: "cod",
    },
    custToken
  );
  check("an incomplete address is refused", noAddress.status === 400, `status ${noAddress.status}`);

  const badPhone = await refuseOrder(
    {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: { ...ADDRESS, phone: "123" },
      paymentMethod: "cod",
    },
    custToken
  );
  check("a bad phone number is refused", badPhone.status === 400, `status ${badPhone.status}`);

  const badPayment = await refuseOrder(
    {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "cheque",
    },
    custToken
  );
  check("an unknown payment method is refused", badPayment.status === 400,
    `status ${badPayment.status}`);

  const noToken = await call("POST", "/orders", {
    body: {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "cod",
    },
  });
  check("placing an order needs a token", noToken.status === 401);

  // Checked here rather than beside the duplicate-reference tests, because
  // order placement is capped at 10/minute per IP and this suite spends that
  // budget on the sections below. A validation check that lands after the cap
  // is spent can only report a 429 and prove nothing.
  const badRef = await refuseOrder(
    {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "cod",
      clientOrderRef: "../../etc/passwd",
    },
    custToken
  );
  check("a malformed client reference is refused", badRef.status === 400,
    `status ${badRef.status}`);

  const nonStringRef = await refuseOrder(
    {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "cod",
      clientOrderRef: { $ne: "spoof" },
    },
    custToken
  );
  check("a non-string client reference is refused", nonStringRef.status === 400,
    `status ${nonStringRef.status}`);

  // An order with no reference at all must still be accepted, and must not
  // collide with any other reference-less order. This is the case that the
  // original sparse index got wrong.
  const noRefOrder = await placeOrder({
    items: [{ productId: aId, quantity: 1 }],
    shippingAddress: ADDRESS,
    paymentMethod: "cod",
  }, custToken);
  check("an order with no client reference is accepted",
    noRefOrder.status === 201, `status ${noRefOrder.status}`);

  const secondNoRefOrder = await placeOrder({
    items: [{ productId: aId, quantity: 1 }],
    shippingAddress: ADDRESS,
    paymentMethod: "cod",
  }, custToken);
  check("a second order with no reference does not collide",
    secondNoRefOrder.status === 201 && secondNoRefOrder.data.order?._id !== noRefOrder.data.order?._id,
    `status ${secondNoRefOrder.status}`);

  for (const id of [noRefOrder.data.order?._id, secondNoRefOrder.data.order?._id].filter(Boolean)) {
    // eslint-disable-next-line no-await-in-loop
    await call("PUT", `/orders/admin/${id}/status`, {
      token,
      body: { orderStatus: "cancelled", cancelledReason: "Phase 3 test: no-reference check" },
    });
  }

  // -------------------------------------------------------------------
  section("The client cannot set prices");

  // A tampered body: an absurd price and a zero-quantity line. The server must
  // ignore both and price from the database.
  const tampered = await placeOrder({
    items: [
      { productId: aId, quantity: 1, price: 1 },
      { productId: bId, quantity: 1, price: 0, name: "Free" },
    ],
    shippingAddress: ADDRESS,
    paymentMethod: "cod",
  }, custToken);

  if (tampered.status === 201) {
    check("a tampered order is still priced from the database",
      tampered.data.order.subtotal === priceA + priceB,
      `subtotal ${tampered.data.order.subtotal} vs ${priceA + priceB}`);
    check("a client-supplied price is not stored",
      tampered.data.order.items[0].price === priceA,
      String(tampered.data.order.items[0].price));
    check("a client-supplied name is not stored",
      !tampered.data.order.items[1].name.includes("Free"),
      tampered.data.order.items[1].name);
    check("a client-supplied name cannot be blanked either",
      tampered.data.order.items[1].name === freshB.name,
      tampered.data.order.items[1].name);
  } else {
    check("the tampering check could run", false,
      `status ${tampered.status}: ${tampered.data.message || JSON.stringify(tampered.data)}`);
  }

  // Clean up that order so the counts below are predictable.
  if (tampered.data.order?._id) {
    await call("PUT", `/orders/admin/${tampered.data.order._id}/status`, {
      token,
      body: {
        orderStatus: "cancelled",
        cancelledReason: "Phase 3 test: clearing the tampering check",
      },
    });
  }

  // -------------------------------------------------------------------
  section("Order creation, totals, stock and the ledger");

  const beforeA = (await call("GET", `/products/${aId}`)).data.product.stock;
  const beforeB = (await call("GET", `/products/${bId}`)).data.product.stock;

  // Read after the successful order, and declared out here because the
  // duplicate-submission section below needs it as its baseline.
  let afterA = beforeA;
  let afterB = beforeB;

  const qtyA = 3;
  const qtyB = 2;
  const expectedSubtotal = priceA * qtyA + priceB * qtyB;

  // The quote endpoint and the order endpoint must agree, by construction:
  // both call the same quoteOrder function.
  const quote = await call("POST", "/coupons/validate", {
    token: custToken,
    body: { items: [{ productId: aId, quantity: qtyA }, { productId: bId, quantity: qtyB }] },
  });
  check("the checkout preview prices the cart", quote.status === 200);

  const placed = await placeOrder({
    items: [{ productId: aId, quantity: qtyA }, { productId: bId, quantity: qtyB }],
    shippingAddress: ADDRESS,
    paymentMethod: "cod",
  }, custToken);

  check("order is created", placed.status === 201 && !!placed.data.order?._id,
    `status ${placed.status}: ${placed.data.message || ""}`);

  const orderId = placed.data.order?._id;

  if (placed.status !== 201) {
    // Without an order the rest of this section has nothing to inspect, and
    // guessing at undefined fields would just produce noise.
    skip("total, stock and ledger checks", "the order could not be created");
  } else {
    check("charged subtotal equals the previewed subtotal",
      placed.data.order.subtotal === quote.data.subtotal,
      `${placed.data.order.subtotal} vs ${quote.data.subtotal}`);
    check("charged total equals the previewed total",
      placed.data.order.total === quote.data.total,
      `${placed.data.order.total} vs ${quote.data.total}`);
    check("total = subtotal - discount + shipping",
      placed.data.order.total
        === placed.data.order.subtotal - placed.data.order.discount
          + placed.data.order.shippingCharge);
    check("the order gets a human order number", /^KE-/.test(placed.data.order.orderNumber || ""));
    check("the order starts pending",
      placed.data.order.orderStatus === "pending" && placed.data.order.paymentStatus === "pending");
    check("the delivery address is snapshotted",
      placed.data.order.shippingAddress.city === "Nashik");
    check("the order records the customer",
      String(placed.data.order.user) === String(cust.data.user._id)
        || placed.data.order.user?._id === cust.data.user._id);

    // Stock.
    afterA = (await call("GET", `/products/${aId}`)).data.product.stock;
    afterB = (await call("GET", `/products/${bId}`)).data.product.stock;
    check("stock was deducted for item A", afterA === beforeA - qtyA, `${beforeA} -> ${afterA}`);
    check("stock was deducted for item B", afterB === beforeB - qtyB, `${beforeB} -> ${afterB}`);

    // The product's stock history is the whole ledger for that product, newest
    // first. Filtering it by the order's id proves this order wrote a row.
    const history = await call("GET", `/admin/inventory/${aId}?limit=100`, { token });
    const sale = (history.data.movements || []).find(
      (m) => String(m.referenceId) === String(orderId)
    );
    check("a SALE movement was written to the ledger for the order", !!sale);
    check("the ledger row is type SALE and removes stock",
      sale?.type === "SALE" && sale?.direction === -1, `${sale?.type}/${sale?.direction}`);
    check("the ledger row records the quantity sold", sale?.quantity === qtyA);
    check("the ledger row records the resulting stock",
      sale?.newStock === afterA && sale?.previousStock === beforeA,
      `${sale?.previousStock} -> ${sale?.newStock}`);
  }

  // -------------------------------------------------------------------
  section("Duplicate submission cannot create two orders");

  const ordersBefore = (await call("GET", `/orders?limit=100`, { token: custToken })).data.total;

  const ref = `phase3-ref-${stamp}`;
  const first = await placeOrder({
    items: [{ productId: aId, quantity: 1 }],
    shippingAddress: ADDRESS,
    paymentMethod: "cod",
    clientOrderRef: ref,
  }, custToken);
  check("an order with a client reference is created", first.status === 201,
    `status ${first.status}: ${first.data.message || ""}`);

  // A repeat of the same reference is a lookup, not a write, so it does not
  // consume the order rate-limit budget.
  const repeat = await call("POST", "/orders", {
    token: custToken,
    body: {
      items: [{ productId: aId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "cod",
      clientOrderRef: ref,
    },
  });
  check("resending the same reference returns the first order",
    repeat.status === 200 && repeat.data.duplicate === true,
    `status ${repeat.status}: ${repeat.data.message || ""}`);
  check("it is the same order, not a new one",
    repeat.data.order?._id === first.data.order?._id);

  const ordersAfter = (await call("GET", `/orders?limit=100`, { token: custToken })).data.total;
  check("exactly one order was added", ordersAfter === ordersBefore + 1,
    `${ordersBefore} -> ${ordersAfter}`);

  // The stock deduction must have happened once, not twice. Read before the
  // reference test so the two assertions cannot interfere.
  const stockAfterRepeat = (await call("GET", `/products/${aId}`)).data.product.stock;
  const expectedAfterRef = (afterA ?? 0) - 1;
  check("stock was deducted once, not twice",
    stockAfterRepeat === expectedAfterRef,
    `${stockAfterRepeat} vs ${expectedAfterRef} (afterA=${afterA})`);

  // Two genuinely simultaneous submits of the same reference. Both are
  // deliberate duplicate attempts, so at most one can create an order.
  const raceRef = `phase3-race-${stamp}`;
  const raceBody = {
    items: [{ productId: bId, quantity: 1 }],
    shippingAddress: ADDRESS,
    paymentMethod: "cod",
    clientOrderRef: raceRef,
  };
  const [r1, r2] = await Promise.all([
    call("POST", "/orders", { token: custToken, body: raceBody }),
    call("POST", "/orders", { token: custToken, body: raceBody }),
  ]);
  const raceIds = new Set([r1.data.order?._id, r2.data.order?._id].filter(Boolean));
  check("two simultaneous identical submissions make one order",
    raceIds.size === 1, `${raceIds.size} distinct orders (${r1.status}/${r2.status})`);

  // The malformed-reference checks live in the checkout validation section
  // above, while the order rate-limit budget still has room.

  // -------------------------------------------------------------------
  section("My orders, and only my orders");

  const mine = await call("GET", "/orders?limit=100", { token: custToken });
  check("the customer can list their orders", mine.status === 200 && mine.data.total >= 3);
  check("every order returned is theirs",
    mine.data.orders.every((o) => {
      const owner = o.user?._id ?? o.user;
      return String(owner) === String(cust.data.user._id);
    }));

  const oneOrder = await call("GET", `/orders/${orderId}`, { token: custToken });
  check("the customer can open their own order", oneOrder.status === 200,
    `status ${oneOrder.status}`);
  if (oneOrder.status === 200) {
    check("the order shows its items and quantities",
      oneOrder.data.order.items.length === 2
        && oneOrder.data.order.items[0].quantity > 0);
    check("the order shows its total and delivery address",
      oneOrder.data.order.total > 0
        && oneOrder.data.order.shippingAddress.line1 === "12 Test Road");
  }

  const stolen = await call("GET", `/orders/${orderId}`, { token: dealerToken });
  check("another customer cannot open someone else's order", stolen.status === 403,
    `status ${stolen.status}`);

  const stolenCancel = await call("PUT", `/orders/${orderId}/cancel`, { token: dealerToken });
  check("another customer cannot cancel someone else's order", stolenCancel.status === 403,
    `status ${stolenCancel.status}`);

  const missing = await call("GET", "/orders/000000000000000000000000", { token: custToken });
  check("a non-existent order is a 404", missing.status === 404);

  const noListToken = await call("GET", "/orders");
  check("listing orders needs a token", noListToken.status === 401);

  // -------------------------------------------------------------------
  section("Dealers buy through the same flow");

  const dealerOrder = await placeOrder({
    items: [{ productId: aId, quantity: 2 }],
    shippingAddress: { ...ADDRESS, fullName: "Phase3 Dealer" },
    paymentMethod: "cod",
  }, dealerToken);
  check("a dealer can place an order", dealerOrder.status === 201,
    `status ${dealerOrder.status}: ${dealerOrder.data.message || ""}`);

  const dealerOrderId = dealerOrder.data.order?._id;

  if (dealerOrder.status === 201) {
    check("the dealer's order is priced from the database",
      dealerOrder.data.order.subtotal === priceA * 2,
      `${dealerOrder.data.order.subtotal} vs ${priceA * 2}`);

    const dealerOrders = await call("GET", "/orders?limit=50", { token: dealerToken });
    check("a dealer sees only their own orders", dealerOrders.data.total === 1,
      `${dealerOrders.data.total} orders`);
    check("the customer's order is not in the dealer's list",
      !dealerOrders.data.orders.some((o) => String(o._id) === String(orderId)));
  } else {
    skip("dealer pricing and list isolation", "the dealer's order could not be created");
  }

  const dealerReadsCustomerOrder = await call("GET", `/orders/${orderId}`, { token: dealerToken });
  check("a dealer cannot read a customer's order", dealerReadsCustomerOrder.status === 403);

  // -------------------------------------------------------------------
  section("A dealer gains no admin access");

  const dealerTries = [
    ["GET", "/admin/suppliers"],
    ["GET", "/admin/inventory/movements"],
    ["GET", "/orders/admin/all"],
  ];

  for (const [method, path] of dealerTries) {
    const res = await call(method, path, { token: dealerToken });
    check(`a dealer is refused ${path}`, res.status === 403, `status ${res.status}`);
  }

  const dealerTriesWrite = await call("PUT", `/orders/admin/${orderId}/status`, {
    token: dealerToken,
    body: { orderStatus: "delivered" },
  });
  check("a dealer cannot change an order's status", dealerTriesWrite.status === 403);

  // -------------------------------------------------------------------
  section("Admin order management");

  const allOrders = await call("GET", "/orders/admin/all?limit=100", { token });
  check("the admin can list all orders", allOrders.status === 200 && allOrders.data.total > 0);
  check("the admin list includes the customer's order",
    allOrders.data.orders.some((o) => String(o._id) === String(orderId)));

  const adminDetail = await call("GET", `/orders/${orderId}`, { token });
  check("the admin can open any order", adminDetail.status === 200);
  check("the admin sees the customer on the order", !!adminDetail.data.order.user?.email);

  const noAdminToken = await call("GET", "/orders/admin/all");
  check("the admin order list needs a token", noAdminToken.status === 401);

  const customerTriesAdmin = await call("GET", "/orders/admin/all", { token: custToken });
  check("a customer is refused the admin order list", customerTriesAdmin.status === 403);

  const searched = await call("GET", `/orders/admin/all?search=${orderId.slice(-6)}`, { token });
  check("the admin can search orders", searched.status === 200);

  // Lifecycle: pending -> confirmed -> packed -> shipped -> delivered.
  for (const status of ["confirmed", "packed", "shipped", "delivered"]) {
    const res = await call("PUT", `/orders/admin/${orderId}/status`, {
      token,
      body: { orderStatus: status },
    });
    check(`admin can move the order to ${status}`,
      res.status === 200 && res.data.order.orderStatus === status,
      `status ${res.status}`);
  }

  const delivered = await call("GET", `/orders/${orderId}`, { token: custToken });
  check("delivering a cash order marks it paid",
    delivered.data.order.paymentStatus === "paid", delivered.data.order.paymentStatus);
  check("a delivery timestamp is recorded", !!delivered.data.order.deliveredAt);

  const badStatus = await call("PUT", `/orders/admin/${orderId}/status`, {
    token,
    body: { orderStatus: "teleported" },
  });
  check("an unknown status is refused", badStatus.status === 400);

  const badAdminOrder = await call("PUT", "/orders/admin/000000000000000000000000/status", {
    token,
    body: { orderStatus: "confirmed" },
  });
  check("a non-existent order is a 404 for the admin too", badAdminOrder.status === 404);

  // -------------------------------------------------------------------
  section("Cancellation returns stock through the ledger");

  const stockBeforeCancel = (await call("GET", `/products/${aId}`)).data.product.stock;

  const refOrderId = first.data.order?._id;

  if (!refOrderId) {
    skip("cancellation and stock return", "the referenced order was not created");
  } else {
    const cancelledByCustomer = await call("PUT", `/orders/${refOrderId}/cancel`, {
      token: custToken,
      body: { reason: "Phase 3 test: changed my mind" },
    });
    check("a customer can cancel their own pending order",
      cancelledByCustomer.status === 200
        && cancelledByCustomer.data.order.orderStatus === "cancelled",
      `status ${cancelledByCustomer.status}`);

    if (cancelledByCustomer.status === 200) {
      const stockAfterCancel = (await call("GET", `/products/${aId}`)).data.product.stock;
      check("cancelling returned the stock", stockAfterCancel === stockBeforeCancel + 1,
        `${stockBeforeCancel} -> ${stockAfterCancel}`);

      const cancelHistory = await call("GET", `/admin/inventory/${aId}?limit=100`, { token });
      const back = (cancelHistory.data.movements || []).find(
        (m) => String(m.referenceId) === String(refOrderId) && m.type === "SALE_CANCEL"
      );
      check("a SALE_CANCEL movement was written", !!back);
      check("the cancellation adds stock back", back?.direction === 1, String(back?.direction));
    }

    const twice = await call("PUT", `/orders/${refOrderId}/cancel`, { token: custToken });
    check("cancelling an already-cancelled order is refused", twice.status === 400,
      `status ${twice.status}`);
  }

  if (dealerOrderId) {
    const lateCancel = await call("PUT", `/orders/${dealerOrderId}/cancel`, {
      token: dealerToken,
    });
    check("a pending order can still be cancelled by its owner", lateCancel.status === 200,
      `status ${lateCancel.status}`);
  } else {
    skip("dealer's own cancellation", "the dealer's order was not created");
  }

  // -------------------------------------------------------------------
  section("Stock can never go negative");

  await setStock(token, aId, 1);

  const [o1, o2] = await Promise.all([
    call("POST", "/orders", {
      token: custToken,
      body: {
        items: [{ productId: aId, quantity: 1 }],
        shippingAddress: ADDRESS,
        paymentMethod: "cod",
      },
    }),
    call("POST", "/orders", {
      token: dealerToken,
      body: {
        items: [{ productId: aId, quantity: 1 }],
        shippingAddress: ADDRESS,
        paymentMethod: "cod",
      },
    }),
  ]);

  const created = [o1, o2].filter((r) => r.status === 201).length;
  check("only one of two orders for the last unit succeeds", created === 1,
    `${o1.status}/${o2.status}`);

  const finalStock = (await call("GET", `/products/${aId}`)).data.product.stock;
  check("stock is exactly zero, never negative", finalStock === 0, `stock is ${finalStock}`);

  // A refused order is a read-and-reject, so retrying after the limiter is
  // harmless here and gets a real verdict instead of a 429.
  const past = await refuseOrder(
    { items: [{ productId: aId, quantity: 1 }], shippingAddress: ADDRESS, paymentMethod: "cod" },
    custToken
  );
  // Two statuses are correct here and which one arrives depends on where the
  // shortage is caught. buildOrderItems rejects up front with 400 (it re-reads
  // stock and finds the basket already impossible), while the atomic guard in
  // applyStockChange returns 409 when another order took the last unit between
  // that check and the deduction. What matters is that it is refused and that
  // stock does not move — both asserted here and by the race test above.
  check("ordering out of stock is refused",
    past.status === 400 || past.status === 409,
    `status ${past.status}: ${past.data.message || ""}`);

  const stillZero = (await call("GET", `/products/${aId}`)).data.product.stock;
  check("a refused order leaves stock untouched", stillZero === 0, `stock is ${stillZero}`);

  const huge = await refuseOrder(
    { items: [{ productId: aId, quantity: 500 }], shippingAddress: ADDRESS, paymentMethod: "cod" },
    custToken
  );
  check("a quantity far beyond stock is refused",
    huge.status === 400 || huge.status === 409, `status ${huge.status}`);

  const afterHuge = (await call("GET", `/products/${aId}`)).data.product.stock;
  check("an absurd quantity does not move stock either", afterHuge === 0,
    `stock is ${afterHuge}`);

  // -------------------------------------------------------------------
  section("CORS is an allowlist, not a wildcard");

  const withOrigin = async (origin) => {
    const res = await fetch(`${BASE}/health`, { headers: { Origin: origin } });
    return res.headers.get("access-control-allow-origin");
  };

  const allowed = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
  const allowHeader = await withOrigin(allowed);
  check("a configured origin is allowed", allowHeader === allowed, String(allowHeader));

  const stranger = await withOrigin("https://not-this-site.example");
  check("an unconfigured origin gets no CORS header",
    stranger === null || stranger === "", String(stranger));

  // -------------------------------------------------------------------
  section("Clean up the orders this run created");

  for (const id of [orderId, refOrderId, dealerOrderId].filter(Boolean)) {
    await call("PUT", `/orders/admin/${id}/status`, {
      token,
      body: { orderStatus: "cancelled", cancelledReason: "Phase 3 test: cleanup" },
    });
  }

  await setStock(token, aId, 40);
  await setStock(token, bId, 25);

  await call("DELETE", "/cart", { token: custToken });
  await call("DELETE", "/cart", { token: dealerToken });

  // -------------------------------------------------------------------
  console.log(`\n${"=".repeat(52)}`);
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) process.exit(1);
};

run().catch((error) => {
  console.error("\nTest run crashed:", error);
  process.exit(1);
});
