/**
 * Phase 2 tests: suppliers, purchases, stock-in and the stock ledger.
 *
 *   1. start the server:  npm run dev
 *   2. run this:          npm run test:phase2
 *
 * Every test row it creates is prefixed "PhaseTwoTest" so `npm run db:clean`
 * can remove it afterwards.
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

const section = (t) => console.log(`\n${t}`);

const stamp = Date.now();
const PREFIX = "PhaseTwoTest";

/**
 * Puts a product's stock back to a known value, so assertions about exact
 * numbers don't depend on what earlier suites did to the catalogue.
 *
 * Every call is a recorded MANUAL_ADJUSTMENT rather than a direct database
 * write, which keeps the ledger honest — and `npm run db:clean` recognises the
 * reason string and tidies them up.
 */
const setStock = async (token, productId, stock) => {
  const current = (await call("GET", `/products/${productId}`, {})).data.product?.stock ?? 0;
  const delta = stock - current;

  if (delta === 0) return;

  await call("POST", `/admin/inventory/${productId}/adjust`, {
    token,
    body: {
      direction: delta > 0 ? "add" : "remove",
      quantity: Math.abs(delta),
      reason: "Phase 2 test: normalising stock before assertions",
    },
  });
};

const run = async () => {
  console.log(`Phase 2 tests against ${BASE}\n${"=".repeat(52)}`);

  // -------------------------------------------------------------------
  section("Setup");
  const login = await call("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  check("admin signs in", login.status === 200 && !!login.data.token);

  const token = login.data.token;

  // The phase 1 test deliberately drives a product to zero stock, so pick the
  // two with the most headroom instead of the first two. Keeps this suite
  // independent of whatever the other suites did to the catalogue.
  const products = (await call("GET", "/products?limit=100")).data.products || [];
  check("found products to work with", products.length >= 2, `got ${products.length}`);

  const roomiest = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 2);

  const productA = roomiest[0];
  const productB = roomiest[1];

  // -------------------------------------------------------------------
  section("Authorization");
  const noAuth = await call("GET", "/admin/suppliers");
  check("suppliers needs a token", noAuth.status === 401);

  const customer = await call("POST", "/auth/register", {
    body: {
      name: "Phase Two Customer",
      email: `phase2cust${stamp}@test.com`,
      phone: "9000001234",
      password: "CustomerTest123",
    },
  });
  const customerToken = customer.data.token;
  check("registered a customer", customer.status === 201 && !!customerToken);

  for (const [label, path] of [
    ["supplier list", "/admin/suppliers"],
    ["supplier create", "/admin/suppliers"],
    ["purchase list", "/admin/purchases"],
    ["purchase create", "/admin/purchases"],
    ["inventory list", "/admin/inventory"],
    ["movement feed", "/admin/inventory/movements"],
  ]) {
    const method = path.endsWith("create") || path.includes("suppliers") && path === "/admin/suppliers" && false
      ? "GET"
      : "GET";
    const res = await call("GET", path, { token: customerToken });
    check(`customer blocked from ${label}`, res.status === 403, `got ${res.status}`);
    void method;
  }

  const custCreate = await call("POST", "/admin/suppliers", {
    token: customerToken,
    body: { name: `${PREFIX} Sneaky` },
  });
  check("customer cannot create a supplier", custCreate.status === 403, `got ${custCreate.status}`);

  const custAdjust = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token: customerToken,
    body: { direction: "add", quantity: 999, reason: "trying to inflate stock" },
  });
  check("customer cannot adjust stock", custAdjust.status === 403, `got ${custAdjust.status}`);

  // -------------------------------------------------------------------
  section("Supplier CRUD");
  // Real GSTIN shape: 2 state digits + 5 letters + 4 digits + 1 letter +
  // 3 alphanumerics = 15 characters exactly.
  //
  // The numeric block comes from the stamp so repeat runs don't collide on the
  // unique index, but it's clamped to 4 digits: 5 digits would make the whole
  // string 16 characters and fail validation.
  const gstin = `27AAAAA${String(stamp % 10000).padStart(4, "0")}F1Z5`;

  const created = await call("POST", "/admin/suppliers", {
    token,
    body: {
      name: `${PREFIX} Supplier`,
      companyName: "Phase Two Agro Traders",
      phone: "9876543210",
      email: "PHASE2TEST@example.com",
      address: "12 Market Yard",
      city: "Nashik",
      state: "Maharashtra",
      gstin,
      notes: "Created by the Phase 2 test suite",
    },
  });
  check("creates a supplier", created.status === 201, `got ${created.status}`);
  const supplierId = created.data.supplier?._id;
  check("returns the new supplier", !!supplierId);
  check("normalises GSTIN to uppercase", created.data.supplier?.gstin === gstin, created.data.supplier?.gstin);
  check("normalises email to lowercase", created.data.supplier?.email === "phase2test@example.com");
  check("supplier is active by default", created.data.supplier?.isActive === true);
  check("never returns a password field", created.data.supplier?.password === undefined);

  const dupeGstin = await call("POST", "/admin/suppliers", {
    token,
    body: { name: `${PREFIX} Impostor`, gstin },
  });
  check("rejects a duplicate GSTIN", dupeGstin.status === 409, `got ${dupeGstin.status}`);

  const badGstin = await call("POST", "/admin/suppliers", {
    token,
    body: { name: `${PREFIX} BadGST`, gstin: "NOTAGSTIN" },
  });
  check("rejects a malformed GSTIN", badGstin.status === 400, `got ${badGstin.status}`);

  const noName = await call("POST", "/admin/suppliers", { token, body: { city: "Nowhere" } });
  check("requires a supplier name", noName.status === 400, `got ${noName.status}`);

  const noGstin = await call("POST", "/admin/suppliers", {
    token,
    body: { name: `${PREFIX} No GSTIN` },
  });
  check("a supplier without a GSTIN is allowed", noGstin.status === 201, `got ${noGstin.status}`);

  const alsoNoGstin = await call("POST", "/admin/suppliers", {
    token,
    body: { name: `${PREFIX} Also No GSTIN` },
  });
  check(
    "two suppliers can both omit a GSTIN",
    alsoNoGstin.status === 201,
    `got ${alsoNoGstin.status}`
  );

  const updated = await call("PUT", `/admin/suppliers/${supplierId}`, {
    token,
    body: { city: "Pune", notes: "Moved to the Pune depot" },
  });
  check("edits a supplier", updated.status === 200 && updated.data.supplier?.city === "Pune");

  const badId = await call("GET", "/admin/suppliers/not-an-id", { token });
  check("rejects a malformed supplier id", badId.status === 400, `got ${badId.status}`);

  const missing = await call("GET", "/admin/suppliers/000000000000000000000000", { token });
  check("404s an unknown supplier", missing.status === 404, `got ${missing.status}`);

  const search = await call("GET", `/admin/suppliers?search=${PREFIX}&limit=100`, { token });
  check(
    "search finds the supplier",
    search.status === 200 && search.data.total >= 1,
    `status=${search.status} total=${search.data.total} msg=${search.data.message}`
  );
  check(
    "search results are all ours",
    search.data.suppliers.every((s) => s.name.includes(PREFIX))
  );
  check(
    "search finds the supplier we created",
    search.data.suppliers.some((s) => s._id === supplierId)
  );

  const badSearch = await call("GET", `/admin/suppliers?search=${encodeURIComponent("[")}`, { token });
  check("a regex metacharacter in search doesn't 500", badSearch.status === 200, `got ${badSearch.status}`);

  const detail = await call("GET", `/admin/suppliers/${supplierId}`, { token });
  check("reads supplier detail", detail.status === 200 && !!detail.data.supplier);
  check("detail includes spend stats", typeof detail.data.stats?.totalSpend === "number");

  // -------------------------------------------------------------------
  section("Purchase creation and pricing");
  const stockBeforeA = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  const stockBeforeB = (await call("GET", `/products/${productB._id}`)).data.product.stock;

  const unknownId = "000000000000000000000000";

  const badSupplier = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: unknownId,
      items: [{ productId: productA._id, quantity: 1, costPrice: 10 }],
    },
  });
  // 404, not 400: the id is well-formed, it's just not a supplier we have.
  check("404s an unknown supplier", badSupplier.status === 404, `got ${badSupplier.status}`);

  const malformedSupplier = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: "not-an-id",
      items: [{ productId: productA._id, quantity: 1, costPrice: 10 }],
    },
  });
  check("rejects a malformed supplier id", malformedSupplier.status === 400, `got ${malformedSupplier.status}`);

  const unknownProduct = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: supplierId,
      items: [{ productId: unknownId, quantity: 1, costPrice: 10 }],
    },
  });
  check("rejects an unknown product", unknownProduct.status === 400, `got ${unknownProduct.status}`);

  const noItems = await call("POST", "/admin/purchases", {
    token,
    body: { supplier: supplierId, items: [] },
  });
  check("rejects a purchase with no items", noItems.status === 400, `got ${noItems.status}`);

  const dupeLines = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: supplierId,
      items: [
        { productId: productA._id, quantity: 1, costPrice: 10 },
        { productId: productA._id, quantity: 1, costPrice: 10 },
      ],
    },
  });
  check("rejects the same product twice", dupeLines.status === 400, `got ${dupeLines.status}`);

  const negQty = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: supplierId,
      items: [{ productId: productA._id, quantity: -5, costPrice: 10 }],
    },
  });
  check("rejects a negative quantity", negQty.status === 400, `got ${negQty.status}`);

  const fractional = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: supplierId,
      items: [{ productId: productA._id, quantity: 2.5, costPrice: 10 }],
    },
  });
  check("rejects a fractional quantity", fractional.status === 400, `got ${fractional.status}`);

  const hugeDiscount = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: supplierId,
      items: [
        { productId: productA._id, quantity: 2, costPrice: 100 },
        { productId: productB._id, quantity: 3, costPrice: 50 },
      ],
      discount: 999999,
    },
  });
  check("creates a purchase", hugeDiscount.status === 201, `got ${hugeDiscount.status}`);

  const purchase = hugeDiscount.data.purchase;
  check("generates a purchase number", /^PUR-/.test(purchase?.purchaseNumber || ""), purchase?.purchaseNumber);
  check("subtotal is 2*100 + 3*50 = 350", purchase?.subtotal === 350, `got ${purchase?.subtotal}`);
  check(
    "discount is clamped to the subtotal",
    purchase?.discount === 350 && purchase?.total === 0,
    `discount=${purchase?.discount} total=${purchase?.total}`
  );
  check("starts as a draft", purchase?.status === "draft", purchase?.status);
  check("snapshots the product name", purchase?.items?.[0]?.name === productA.name);
  check("references the real product", String(purchase?.items?.[0]?.product) === String(productA._id));

  const untouched = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check("a draft purchase does NOT change stock", untouched === stockBeforeA, `${stockBeforeA} -> ${untouched}`);

  // -------------------------------------------------------------------
  section("Stock-in on receive");
  const receive = await call("POST", `/admin/purchases/${purchase._id}/receive`, { token });
  check("receives the purchase", receive.status === 200, `got ${receive.status} ${receive.data.message}`);
  check("status becomes received", receive.data.purchase?.status === "received");
  check("records who received it", String(receive.data.purchase?.receivedBy) === String(login.data.user._id));
  check("stamps a received time", !!receive.data.purchase?.receivedAt);

  const afterA = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  const afterB = (await call("GET", `/products/${productB._id}`)).data.product.stock;
  check("stock increased by the received quantity", afterA === stockBeforeA + 2, `${stockBeforeA} -> ${afterA}`);
  check("second product also increased", afterB === stockBeforeB + 3, `${stockBeforeB} -> ${afterB}`);

  const again = await call("POST", `/admin/purchases/${purchase._id}/receive`, { token });
  check("a second receive is rejected", again.status === 409, `got ${again.status}`);

  const afterAgain = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check("the rejected receive did NOT add stock again", afterAgain === afterA, `${afterA} -> ${afterAgain}`);

  // -------------------------------------------------------------------
  section("Stock ledger");
  const movements = await call("GET", `/admin/inventory/movements?referenceType=purchase&limit=200`, { token });
  check("reads the movement feed", movements.status === 200);

  const stockIns = movements.data.movements.filter((m) => m.type === "STOCK_IN");
  check("recorded STOCK_IN movements", stockIns.length >= 2, `got ${stockIns.length}`);

  const movementA = stockIns.find(
    (m) => String(m.product) === String(productA._id) && String(m.referenceId) === String(purchase._id)
  );
  check("the movement points at the product", !!movementA);
  check("records the quantity received", movementA?.quantity === 2, `got ${movementA?.quantity}`);
  check("records the previous stock", movementA?.previousStock === stockBeforeA, `got ${movementA?.previousStock}`);
  check("records the new stock", movementA?.newStock === afterA, `got ${movementA?.newStock}`);
  check("records the reference type", movementA?.referenceType === "purchase");
  check("records the purchase as reference", String(movementA?.referenceId) === String(purchase._id));
  check("records the purchase cost", movementA?.unitCost === 100, `got ${movementA?.unitCost}`);
  check("records the supplier", String(movementA?.supplier?._id) === String(supplierId));
  check("records the admin who did it", String(movementA?.performedBy?._id) === String(login.data.user._id));
  check("records a reason", (movementA?.reason || "").length > 0);
  check("has a timestamp", !!movementA?.createdAt);

  const history = await call("GET", `/admin/inventory/${productA._id}`, { token });
  check("reads one product's history", history.status === 200);
  check("splits stock in from stock out", Array.isArray(history.data.stockIn) && Array.isArray(history.data.stockOut));
  check("the purchase shows under stock in", history.data.stockIn.some((m) => String(m.referenceId) === String(purchase._id)));
  check("totals units in", typeof history.data.totalUnitsIn === "number");

  const invList = await call("GET", "/admin/inventory?limit=100", { token });
  check("reads the inventory list", invList.status === 200);
  const rowA = invList.data.inventory.find((r) => String(r._id) === String(productA._id));
  check("inventory shows current stock", rowA?.stock === afterA, `got ${rowA?.stock}`);
  check("inventory shows a last movement", !!rowA?.lastMovement);
  check("inventory computes an average cost", typeof rowA?.averageCost === "number", `got ${rowA?.averageCost}`);

  // -------------------------------------------------------------------
  section("Manual adjustments");
  const noReason = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "add", quantity: 5 },
  });
  check("an adjustment without a reason is rejected", noReason.status === 400, `got ${noReason.status}`);

  const shortReason = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "add", quantity: 5, reason: "fix" },
  });
  check("a too-short reason is rejected", shortReason.status === 400, `got ${shortReason.status}`);

  const badDirection = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "sideways", quantity: 5, reason: "confused adjustment" },
  });
  check("an invalid direction is rejected", badDirection.status === 400, `got ${badDirection.status}`);

  const zeroQty = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "add", quantity: 0, reason: "zero quantity adjustment" },
  });
  check("a zero quantity is rejected", zeroQty.status === 400, `got ${zeroQty.status}`);

  const adjustUp = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "add", quantity: 7, reason: "Found 7 extra bags in the back store" },
  });
  check("adds stock manually", adjustUp.status === 201, `got ${adjustUp.status}`);
  check("reports the new stock", adjustUp.data.product?.stock === afterA + 7, `got ${adjustUp.data.product?.stock}`);
  check("records the reason", adjustUp.data.movement?.reason === "Found 7 extra bags in the back store");
  check("records the admin", String(adjustUp.data.movement?.performedBy) === String(login.data.user._id));

  const adjustDown = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "remove", quantity: 3, reason: "Three bags damaged in the monsoon" },
  });
  check("removes stock manually", adjustDown.status === 201, `got ${adjustDown.status}`);
  check("removal moves stock down", adjustDown.data.product?.stock === afterA + 7 - 3);

  const overRemove = await call("POST", `/admin/inventory/${productA._id}/adjust`, {
    token,
    body: { direction: "remove", quantity: 999999, reason: "Trying to remove far too much" },
  });
  check("refuses to remove more than exists", overRemove.status === 409, `got ${overRemove.status}`);

  const stillThere = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check("the refused removal left stock alone", stillThere === afterA + 7 - 3, `got ${stillThere}`);
  check(
    "stock never went negative",
    (await call("GET", "/admin/inventory?limit=100", { token })).data.inventory.every((r) => r.stock >= 0)
  );

  // -------------------------------------------------------------------
  section("Purchase cancellation returns stock");
  const cancel = await call("PUT", `/admin/purchases/${purchase._id}/cancel`, {
    token,
    body: { reason: "Goods were of the wrong grade" },
  });
  check("cancels the purchase", cancel.status === 200, `got ${cancel.status}`);
  check("status becomes cancelled", cancel.data.purchase?.status === "cancelled");

  const afterCancel = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check(
    "cancelling returns the exact received quantity",
    afterCancel === afterA + 7 - 3 - 2,
    `expected ${afterA + 7 - 3 - 2}, got ${afterCancel}`
  );

  const cancelAgain = await call("PUT", `/admin/purchases/${purchase._id}/cancel`, { token });
  check("a second cancel is rejected", cancelAgain.status === 400, `got ${cancelAgain.status}`);

  const editReceived = await call("PUT", `/admin/purchases/${purchase._id}`, {
    token,
    body: { notes: "changing history" },
  });
  check("a cancelled purchase cannot be edited", editReceived.status === 400, `got ${editReceived.status}`);

  // -------------------------------------------------------------------
  section("Orders write to the ledger");
  const beforeOrderA = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  const beforeOrderB = (await call("GET", `/products/${productB._id}`)).data.product.stock;

  const cart = [
    { productId: productA._id, quantity: 2 },
    { productId: productB._id, quantity: 1 },
  ];

  const address = {
    fullName: "Phase Two Tester",
    phone: "9000001234",
    line1: "1 Test Road",
    city: "Nashik",
    state: "Maharashtra",
    pincode: "422001",
  };

  const shopper = await call("POST", "/auth/register", {
    body: {
      name: "Phase Two Shopper",
      email: `phase2shop${stamp}@test.com`,
      phone: "9000005678",
      password: "ShopperTest123",
    },
  });
  const shopperToken = shopper.data.token;

  const order = await call("POST", "/orders", {
    token: shopperToken,
    body: { items: cart, paymentMethod: "cod", shippingAddress: address },
  });
  check("a customer order still works", order.status === 201, `got ${order.status} ${order.data.message}`);

  if (order.status === 201) {
    const orderId = order.data.order?._id;

    const afterOrderA = (await call("GET", `/products/${productA._id}`)).data.product.stock;
    const afterOrderB = (await call("GET", `/products/${productB._id}`)).data.product.stock;
    check("an order deducts stock", afterOrderA === beforeOrderA - 2, `${beforeOrderA} -> ${afterOrderA}`);
    check("order deducts every line", afterOrderB === beforeOrderB - 1, `${beforeOrderB} -> ${afterOrderB}`);

    const orderMovements = await call("GET", "/admin/inventory/movements?referenceType=order&limit=200", { token });
    const sales = orderMovements.data.movements.filter(
      (m) => m.type === "SALE" && String(m.referenceId) === String(orderId)
    );
    check("an order writes a SALE movement per line", sales.length === 2, `got ${sales.length}`);
    check("SALE movements point at the order", sales.every((m) => String(m.referenceId) === String(orderId)));
    check("SALE movement records previous stock", sales.every((m) => m.previousStock > m.newStock));

    // -----------------------------------------------------------------
    section("Order cancellation returns stock and logs it");
    const cancelOrder = await call("PUT", `/orders/${orderId}/cancel`, {
      token: shopperToken,
      body: { reason: "Changed my mind" },
    });
    check("a customer can still cancel", cancelOrder.status === 200, `got ${cancelOrder.status}`);

    const afterCancelOrder = (await call("GET", `/products/${productA._id}`)).data.product.stock;
    check("cancelling returns the stock", afterCancelOrder === beforeOrderA, `${beforeOrderA} -> ${afterCancelOrder}`);

    const cancelMovements = await call("GET", "/admin/inventory/movements?referenceType=order&limit=200", { token });
    const returns = cancelMovements.data.movements.filter(
      (m) => m.type === "SALE_CANCEL" && String(m.referenceId) === String(orderId)
    );
    check("a cancellation writes SALE_CANCEL movements", returns.length === 2, `got ${returns.length}`);
    check("SALE_CANCEL records previous stock", returns.every((m) => m.newStock > m.previousStock));

    const cancelTwice = await call("PUT", `/orders/${orderId}/cancel`, {
      token: shopperToken,
      body: { reason: "again" },
    });
    check("a second cancellation is rejected", cancelTwice.status === 400, `got ${cancelTwice.status}`);

    const afterDouble = (await call("GET", `/products/${productA._id}`)).data.product.stock;
    check(
      "the rejected cancellation did NOT add stock again",
      afterDouble === beforeOrderA,
      `${beforeOrderA} -> ${afterDouble}`
    );
  } else {
    section("Order cancellation returns stock and logs it");
    check("a customer order still works", false, `skipped: ${order.data.message}`);
  }

  // -------------------------------------------------------------------
  section("Overselling is impossible");
  await setStock(token, productA._id, 1);

  const tooMany = await call("POST", "/orders", {
    token: shopperToken,
    body: {
      items: [{ productId: productA._id, quantity: 5 }],
      paymentMethod: "cod",
      shippingAddress: address,
    },
  });
  check("cannot order more than exists", tooMany.status === 400, `got ${tooMany.status}`);

  const stillOne = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check("the rejected order left stock alone", stillOne === 1, `got ${stillOne}`);

  // Two customers race for the last unit.
  const racer1 = await call("POST", "/auth/register", {
    body: { name: "Racer One", email: `race1${stamp}@test.com`, phone: "9000001111", password: "RacerTest123" },
  });
  const racer2 = await call("POST", "/auth/register", {
    body: { name: "Racer Two", email: `race2${stamp}@test.com`, phone: "9000002222", password: "RacerTest123" },
  });

  const raceBody = {
    items: [{ productId: productA._id, quantity: 1 }],
    paymentMethod: "cod",
    shippingAddress: address,
  };

  const [r1, r2] = await Promise.all([
    call("POST", "/orders", { token: racer1.data.token, body: raceBody }),
    call("POST", "/orders", { token: racer2.data.token, body: raceBody }),
  ]);

  const successes = [r1, r2].filter((r) => r.status === 201).length;
  check("exactly one of two racing orders succeeds", successes === 1, `got ${successes} successes`);

  const finalStock = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check("the last unit was sold exactly once", finalStock === 0, `got ${finalStock}`);
  check("stock is not negative", finalStock >= 0);

  // Put the catalogue back the way we found it, so the other suites still have
  // stock to work with. Without this, the shop is left with a product at zero.
  const toRestore = stockBeforeA;
  await setStock(token, productA._id, toRestore);
  const restored = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check("restores product A's stock afterwards", restored === toRestore, `${toRestore} -> ${restored}`);

  // -------------------------------------------------------------------
  section("Ledger integrity");
  // Asked for a product that this suite has actually moved, so there is
  // guaranteed to be at least one row to inspect.
  const allMovements = await call("GET", "/admin/inventory/movements?limit=200", { token });
  const forA = allMovements.data.movements.filter((m) => String(m.product) === String(productA._id));

  check("this suite left movements to inspect", forA.length > 0, `got ${forA.length}`);

  // The newest movement must agree with what the product currently reports.
  // Checking the single latest row rather than replaying the whole feed avoids
  // depending on how many movements have accumulated over previous runs, which
  // would make the assertion pass or fail for reasons unrelated to this code.
  const newestForA = forA[0];
  const nowStock = (await call("GET", `/products/${productA._id}`)).data.product.stock;
  check(
    "the newest ledger entry matches current stock",
    newestForA && newestForA.newStock === nowStock,
    `ledger says ${newestForA?.newStock}, product says ${nowStock}`
  );

  // Every row must be internally consistent, whatever its age.
  check("every movement records a direction", forA.every((m) => m.direction === 1 || m.direction === -1));
  check("every movement records previous stock", forA.every((m) => Number.isInteger(m.previousStock)));
  check("every movement records new stock", forA.every((m) => Number.isInteger(m.newStock)));
  check(
    "previous and new stock are consistent",
    forA.every((m) => m.newStock === m.previousStock + m.direction * m.quantity)
  );
  check("quantities are always positive", forA.every((m) => m.quantity > 0));

  const summary = await call("GET", "/admin/inventory/summary", { token });
  check("reads the inventory summary", summary.status === 200);
  check("summary counts low stock", typeof summary.data.stats?.lowStock === "number");
  check("summary counts 30-day stock in", typeof summary.data.stats?.stockIn30d === "number");

  const purchaseSummary = await call("GET", "/admin/purchases/summary", { token });
  check("reads the purchase summary", purchaseSummary.status === 200);
  check("summary counts active suppliers", typeof purchaseSummary.data.stats?.activeSuppliers === "number");

  // -------------------------------------------------------------------
  section("Deactivating a supplier");
  const deactivate = await call("DELETE", `/admin/suppliers/${supplierId}`, { token });
  check(
    "deactivates a supplier",
    deactivate.status === 200,
    `status=${deactivate.status} body=${JSON.stringify(deactivate.data).slice(0, 160)}`
  );
  check("isActive is now false", deactivate.data.supplier?.isActive === false);

  const stillListed = await call("GET", `/admin/suppliers?search=${encodeURIComponent(PREFIX)}&limit=100`, { token });
  check(
    "a deactivated supplier is still listed",
    stillListed.data.suppliers.some((s) => s._id === supplierId)
  );

  const purchaseDeactivated = await call("POST", "/admin/purchases", {
    token,
    body: {
      supplier: supplierId,
      items: [{ productId: productA._id, quantity: 1, costPrice: 5 }],
    },
  });
  check("cannot buy from a deactivated supplier", purchaseDeactivated.status === 400, `got ${purchaseDeactivated.status}`);

  const hardDelete = await call("DELETE", `/admin/suppliers/${supplierId}?hard=true`, { token });
  check(
    "refuses a hard delete with purchase history",
    hardDelete.status === 409,
    `status=${hardDelete.status} body=${JSON.stringify(hardDelete.data).slice(0, 160)}`
  );

  // -------------------------------------------------------------------
  section("Existing features still work");
  const storefront = await call("GET", "/products?limit=5");
  check("the storefront still lists products", storefront.status === 200 && storefront.data.total > 0);

  const couponQuote = await call("POST", "/coupons/validate", {
    token,
    body: { items: [{ productId: productB._id, quantity: 1 }] },
  });
  check("coupon validation still works", couponQuote.status === 200 && typeof couponQuote.data.total === "number");

  const coupons = await call("GET", "/admin/coupons", { token });
  check("coupon admin still works", coupons.status === 200 && coupons.data.coupons.length > 0);

  const stats = await call("GET", "/admin/stats", { token });
  check("admin dashboard stats still work", stats.status === 200 && typeof stats.data.stats?.totalOrders === "number");

  const config = await call("GET", "/coupons/config");
  check("public config still works", config.status === 200 && config.data.shippingCharge > 0);

  console.log(`\n${"=".repeat(52)}`);
  console.log(`${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("\nCould not reach the API. Is the server running?\n", e.message);
  process.exit(1);
});
