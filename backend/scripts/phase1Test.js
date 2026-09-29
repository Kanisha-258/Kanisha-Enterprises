/**
 * Phase 1 backend checks: coupon validation + password reset.
 *
 *   1. start the server:  npm run dev
 *   2. run this:          node scripts/phase1Test.js
 */
const BASE = process.env.API_URL || "http://localhost:5000/api";

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
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`); }
};

const section = (t) => console.log(`\n${t}`);
const stamp = Date.now();

const run = async () => {
  console.log(`Phase 1 tests against ${BASE}\n${"=".repeat(50)}`);

  // ---------------------------------------------------------------
  section("Setup");
  const email = `phase1${stamp}@test.com`;
  const reg = await call("POST", "/auth/register", {
    body: { name: "Phase One", email, phone: "9000000001", password: "OriginalPass123" },
  });
  check("registered a customer", reg.status === 201 && !!reg.data.token, `got ${reg.status}`);

  const token = reg.data.token;
  // Pick something comfortably above HARVEST10's Rs 500 minimum order value,
  // so the happy path is genuinely exercised.
  const all = (await call("GET", "/products?limit=60&inStock=true&sort=price_desc")).data.products || [];
  const product = all.find((p) => (p.discountPrice > 0 ? p.discountPrice : p.price) >= 600);
  check("found a product above the coupon minimum", !!product);

  const cart = [{ productId: product._id, quantity: 1 }];

  // ---------------------------------------------------------------
  section("Coupon validation endpoint");
  const cfg = await call("GET", "/coupons/config");
  check("config exposes shipping charge", typeof cfg.data.shippingCharge === "number");

  const noCoupon = await call("POST", "/coupons/validate", { token, body: { items: cart } });
  check("validates a cart with no code", noCoupon.status === 200);
  check("no code is reported as valid", noCoupon.data.valid === true);
  const subtotal = noCoupon.data.subtotal;

  const good = await call("POST", "/coupons/validate", {
    token, body: { items: cart, couponCode: "HARVEST10" },
  });
  check("accepts a real coupon", good.data.valid === true, good.data.message);
  check("returns a non-zero discount", good.data.discount > 0, `discount=${good.data.discount}`);
  check("discount is capped at maxDiscount", good.data.discount <= 150, `discount=${good.data.discount}`);
  check("returns the applied coupon", good.data.appliedCoupon?.code === "HARVEST10");
  check("totals are internally consistent",
    good.data.total === good.data.subtotal - good.data.discount + good.data.shippingCharge,
    JSON.stringify(good.data));

  const bogus = await call("POST", "/coupons/validate", {
    token, body: { items: cart, couponCode: "NOTAREALCODE" },
  });
  check("rejects an unknown code", bogus.status === 200 && bogus.data.valid === false);
  check("explains why (not_found)", bogus.data.couponReason === "not_found", bogus.data.couponReason);
  check("unknown code still returns a full quote", typeof bogus.data.total === "number");

  const malformed = await call("POST", "/coupons/validate", {
    token, body: { items: cart, couponCode: "a" },
  });
  check("rejects a malformed code", malformed.data.couponReason === "malformed", malformed.data.couponReason);

  const minOrder = await call("POST", "/coupons/validate", {
    token, body: { items: cart, couponCode: "FARMER200" },
  });
  check("enforces minimum order value",
    subtotal >= 1500 ? minOrder.data.valid === true : minOrder.data.couponReason === "min_order_not_met",
    `${minOrder.data.couponReason} (subtotal ${subtotal})`);

  // The quote must not have side effects.
  const afterValidate = (await call("GET", `/products/${product.slug || product._id}`)).data.product;
  check("validation does not reserve stock",
    afterValidate.stock === product.stock, `${product.stock} -> ${afterValidate.stock}`);

  // ---------------------------------------------------------------
  section("Preview total matches charged total");
  const preview = await call("POST", "/coupons/validate", {
    token, body: { items: cart, couponCode: "HARVEST10" },
  });
  const addr = { fullName: "Phase One", phone: "9000000001", line1: "1 Test Road", city: "Nashik", state: "Maharashtra", pincode: "422001" };
  const placed = await call("POST", "/orders", {
    token, body: { items: cart, paymentMethod: "cod", shippingAddress: addr, couponCode: "HARVEST10" },
  });

  if (placed.status === 201) {
    const o = placed.data.order;
    check("order was created", !!o.orderNumber);
    check("charged subtotal equals previewed subtotal", o.subtotal === preview.data.subtotal, `${o.subtotal} vs ${preview.data.subtotal}`);
    check("charged discount equals previewed discount", o.discount === preview.data.discount, `${o.discount} vs ${preview.data.discount}`);
    check("charged shipping equals previewed shipping", o.shippingCharge === preview.data.shippingCharge);
    check("charged total equals previewed total", o.total === preview.data.total, `${o.total} vs ${preview.data.total}`);
    await call("PUT", `/orders/${o._id}/cancel`, { token, body: { reason: "cleanup" } });
  } else {
    check("order was created", false, `${placed.status}: ${placed.data.message}`);
  }

  // ---------------------------------------------------------------
  section("Password reset - request");
  const forgot = await call("POST", "/auth/forgot-password", { body: { email } });
  check("accepts a reset request", forgot.status === 200);
  check("uses a non-enumerable message", /if an account exists/i.test(forgot.data.message || ""), forgot.data.message);
  check("returns a token in development", !!forgot.data.devResetToken);

  const unknown = await call("POST", "/auth/forgot-password", { body: { email: `nobody${stamp}@test.com` } });
  check("unknown email gets the same message",
    unknown.status === 200 && unknown.data.message === forgot.data.message,
    `${unknown.status} ${unknown.data.message}`);
  check("unknown email leaks no token", !unknown.data.devResetToken);

  // ---------------------------------------------------------------
  section("Password reset - redeem");
  const raw = forgot.data.devResetToken;

  const status = await call("GET", `/auth/reset-password/status?token=${raw}`);
  check("status endpoint reports the token valid", status.data.valid === true);

  const shortPw = await call("POST", "/auth/reset-password", { body: { token: raw, newPassword: "short" } });
  check("rejects a too-short password", shortPw.status === 400);

  const badToken = await call("POST", "/auth/reset-password", { body: { token: "deadbeef", newPassword: "NewPass12345" } });
  check("rejects a forged token", badToken.status === 400);
  check("forged token gives a generic error", /invalid or has expired/i.test(badToken.data.message || ""), badToken.data.message);

  const didReset = await call("POST", "/auth/reset-password", { body: { token: raw, newPassword: "BrandNewPass123" } });
  check("redeems the token", didReset.status === 200, didReset.data.message);

  // ---------------------------------------------------------------
  section("Password reset - effects");
  const oldLogin = await call("POST", "/auth/login", { body: { email, password: "OriginalPass123" } });
  check("old password no longer works", oldLogin.status === 401);

  const newLogin = await call("POST", "/auth/login", { body: { email, password: "BrandNewPass123" } });
  check("new password works", newLogin.status === 200 && !!newLogin.data.token);
  check("login never returns a password hash", newLogin.data.user?.password === undefined);

  const reuse = await call("POST", "/auth/reset-password", { body: { token: raw, newPassword: "Another12345" } });
  check("token cannot be reused", reuse.status === 400);

  const afterUse = await call("GET", `/auth/reset-password/status?token=${raw}`);
  check("status reports the token spent", afterUse.data.valid === false);

  // A second request invalidates the first.
  const r1 = await call("POST", "/auth/forgot-password", { body: { email } });
  const r2 = await call("POST", "/auth/forgot-password", { body: { email } });
  const firstStillWorks = await call("POST", "/auth/reset-password", {
    body: { token: r1.data.devResetToken, newPassword: "ShouldNotApply123" },
  });
  check("issuing a new link invalidates the old one", firstStillWorks.status === 400);
  const secondWorks = await call("POST", "/auth/reset-password", {
    body: { token: r2.data.devResetToken, newPassword: "FinalPass12345" },
  });
  check("the newest link still works", secondWorks.status === 200, secondWorks.data.message);

  // ---------------------------------------------------------------
  section("Password reset - doesn't break existing auth");
  const fresh = await call("POST", "/auth/register", {
    body: { name: "Still Works", email: `still${stamp}@test.com`, phone: "9000000002", password: "Unchanged12345" },
  });
  check("register still works", fresh.status === 201 && !!fresh.data.token);

  const freshLogin = await call("POST", "/auth/login", {
    body: { email: `still${stamp}@test.com`, password: "Unchanged12345" },
  });
  check("login still works", freshLogin.status === 200);

  const me = await call("GET", "/auth/me", { token: freshLogin.data.token });
  check("getMe still works", me.status === 200 && me.data.user.email === `still${stamp}@test.com`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("\nCould not reach the API. Is the server running?\n", e.message);
  process.exit(1);
});
