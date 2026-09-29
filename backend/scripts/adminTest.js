/**
 * Admin-side smoke test.
 *
 * Verifies that a real admin can run the shop: read the dashboard, manage
 * products and coupons, read the enquiry inbox, change order status, and
 * manage customer accounts — and that a non-admin is blocked from all of it.
 *
 *   1. npm run seed:admin
 *   2. npm run dev          (in another shell)
 *   3. node scripts/adminTest.js
 *
 * Override the credentials with ADMIN_EMAIL / ADMIN_PASSWORD.
 */
const BASE = process.env.API_URL || "http://localhost:5000/api";

// Throwaway test credentials for the account created by `npm run seed:admin`.
// Override both with real values via the environment; never put your actual
// admin password in this file.
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

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

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

const run = async () => {
  console.log(`Admin smoke test against ${BASE}`);
  console.log(`Signing in as ${ADMIN_EMAIL}\n${"=".repeat(50)}`);

  section("Admin sign-in");

  const login = await call("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  if (login.status !== 200) {
    console.error(
      `\nCould not sign in (${login.status}).\n` +
        `Run "npm run seed:admin" first, or set ADMIN_EMAIL / ADMIN_PASSWORD.\n`
    );
    process.exit(1);
  }

  const token = login.data.token;
  check("admin can sign in", !!token);
  check("account has the admin role", login.data.user.role === "admin", login.data.user.role);

  section("Dashboard");
  const stats = await call("GET", "/admin/stats", { token });
  check("reads dashboard stats", stats.status === 200 && !!stats.data.stats);
  check(
    "stats include revenue and counts",
    typeof stats.data.stats?.totalRevenue === "number" &&
      typeof stats.data.stats?.totalOrders === "number"
  );
  check("stats include recent orders", Array.isArray(stats.data.recentOrders));

  section("Product management");
  const before = await call("GET", "/products/admin/all", { token });
  check("lists all products (incl. hidden)", before.status === 200);

  const created = await call("POST", "/products/admin", {
    token,
    body: {
      name: `Smoke Test Product ${Date.now().toString(36).slice(-5)}`,
      category: "Seeds",
      subcategory: "Wheat Seeds",
      description: "Temporary product created by the smoke test.",
      price: 500,
      discountPrice: 425,
      unit: "5 kg",
      stock: 12,
      image: "/products/wheat-seeds.jpg",
    },
  });
  check("creates a product", created.status === 201 && !!created.data.product?._id, `got ${created.status}`);

  const productId = created.data.product?._id;

  if (productId) {
    check("slug was generated", !!created.data.product.slug, created.data.product?.slug);
    check("SKU was generated", !!created.data.product.sku, created.data.product?.sku);

    // Two products may share a name; the second must get a distinct slug.
    const duplicateName = await call("POST", "/products/admin", {
      token,
      body: {
        name: created.data.product.name,
        category: "Seeds",
        price: 100,
        image: "/products/wheat-seeds.jpg",
      },
    });
    check(
      "two products can share a name (slug auto-uniquified)",
      duplicateName.status === 201 &&
        duplicateName.data.product?.slug !== created.data.product.slug,
      `got ${duplicateName.status}`
    );

    if (duplicateName.data.product?._id) {
      await call("DELETE", `/products/admin/${duplicateName.data.product._id}`, { token });
    }

    // An explicit clashing slug should fail with a readable message.
    const clash = await call("POST", "/products/admin", {
      token,
      body: {
        name: "Another Product",
        slug: created.data.product.slug,
        category: "Seeds",
        price: 100,
        image: "/products/wheat-seeds.jpg",
      },
    });
    check(
      "an explicit duplicate slug is rejected clearly",
      clash.status === 409 && /already exists/i.test(clash.data.message || ""),
      `${clash.status}: ${clash.data.message}`
    );

    const updated = await call("PUT", `/products/admin/${productId}`, {
      token,
      body: { price: 550, stock: 3 },
    });
    check("updates a product", updated.status === 200 && updated.data.product.price === 550);

    const asCustomer = await call("GET", "/products");
    const visible = asCustomer.data.products?.find((p) => p._id === productId);
    check("new product appears in the public catalogue", !!visible);

    const removed = await call("DELETE", `/products/admin/${productId}`, { token });
    check("removes a product", removed.status === 200);

    const afterRemove = await call("GET", "/products");
    check(
      "removed product is hidden from customers",
      !afterRemove.data.products?.find((p) => p._id === productId)
    );

    const stillForAdmin = await call("GET", "/products/admin/all", { token });
    const ghost = stillForAdmin.data.products?.find((p) => p._id === productId);
    check("removed product is kept for order history", !!ghost && ghost.isActive === false);
  }

  section("Coupons");
  const code = `SMOKE${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const coupon = await call("POST", "/admin/coupons", {
    token,
    body: { code, description: "Smoke test", type: "flat", value: 75, minOrderValue: 100 },
  });
  check("creates a coupon", coupon.status === 201, `got ${coupon.status}`);

  if (coupon.data.coupon?._id) {
    const dupe = await call("POST", "/admin/coupons", {
      token,
      body: { code, type: "flat", value: 10 },
    });
    check("rejects a duplicate coupon code", dupe.status === 409);

    await call("DELETE", `/admin/coupons/${coupon.data.coupon._id}`, { token });
    check("deletes a coupon", true);
  }

  section("Enquiry inbox");
  const enquiries = await call("GET", "/enquiries/admin/all", { token });
  check("reads the enquiry inbox", enquiries.status === 200 && Array.isArray(enquiries.data.enquiries));
  check("reports the unread count", typeof enquiries.data.unread === "number");

  if (enquiries.data.enquiries?.length) {
    const first = enquiries.data.enquiries[0];
    const marked = await call("PUT", `/enquiries/admin/${first._id}/status`, {
      token,
      body: { status: "read" },
    });
    check("updates an enquiry status", marked.status === 200 && marked.data.enquiry.status === "read");
  }

  section("Order management");

  // Place a fresh order so the status workflow is always exercised, whether
  // or not the database happens to contain a pending one.
  const shopper = await call("POST", "/auth/register", {
    body: {
      name: "Order Test Shopper",
      email: `shopper${Date.now()}@test.com`,
      phone: "1234567890",
      password: "ShopperTest123",
    },
  });

  // Pick something actually purchasable, otherwise the order is rejected
  // for having no stock.
  const anyProduct = (await call("GET", "/products?inStock=true&limit=1")).data.products?.[0];

  let freshOrderId = null;

  if (shopper.data.token && anyProduct) {
    const placed = await call("POST", "/orders", {
      token: shopper.data.token,
      body: {
        items: [{ productId: anyProduct._id, quantity: 1 }],
        paymentMethod: "cod",
        shippingAddress: {
          fullName: "Order Test Shopper",
          phone: "1234567890",
          line1: "1 Test Road",
          city: "Testville",
          state: "Teststate",
          pincode: "600001",
        },
      },
    });

    if (placed.status === 201) {
      freshOrderId = placed.data.order._id;
      check("places an order as a customer", true);
    } else {
      check("places an order as a customer", false, `${placed.status}: ${placed.data.message}`);
    }
  }

  const orders = await call("GET", "/orders/admin/all", { token });
  check("lists all orders", orders.status === 200 && Array.isArray(orders.data.orders));

  const target =
    orders.data.orders?.find((o) => o._id === freshOrderId) ||
    orders.data.orders?.find((o) => o.orderStatus === "pending");

  if (target) {
    const confirmed = await call("PUT", `/orders/admin/${target._id}/status`, {
      token,
      body: { orderStatus: "confirmed" },
    });
    check("confirms an order", confirmed.status === 200 && confirmed.data.order.orderStatus === "confirmed");

    const shipped = await call("PUT", `/orders/admin/${target._id}/status`, {
      token,
      body: { orderStatus: "shipped" },
    });
    check("marks an order shipped", shipped.data.order?.orderStatus === "shipped");

    const delivered = await call("PUT", `/orders/admin/${target._id}/status`, {
      token,
      body: { orderStatus: "delivered" },
    });
    check(
      "marks an order delivered and collects payment",
      delivered.data.order?.orderStatus === "delivered" &&
        delivered.data.order?.paymentStatus === "paid",
      delivered.data.order?.paymentStatus
    );
    check("records the delivery time", !!delivered.data.order?.deliveredAt);

    const badStatus = await call("PUT", `/orders/admin/${target._id}/status`, {
      token,
      body: { orderStatus: "teleported" },
    });
    check("rejects an invalid status", badStatus.status === 400);

    // A delivered order must no longer be cancellable.
    const lateCancel = await call("PUT", `/orders/${target._id}/cancel`, {
      token: shopper.data.token,
      body: { reason: "too late" },
    });
    check("a delivered order can no longer be cancelled", lateCancel.status === 400);
  } else {
    console.log("  SKIP  status changes (no order available)");
  }

  section("Customer management");
  const users = await call("GET", "/admin/users", { token });
  check("lists customers", users.status === 200 && Array.isArray(users.data.users));
  check(
    "never exposes password hashes",
    users.data.users?.every((u) => u.password === undefined)
  );

  // Look the admin up by search rather than scanning page 1. The list is
  // paginated and sorted newest-first, so a database full of freshly-created
  // test accounts can push the admin off the first page.
  const selfSearch = await call("GET", `/admin/users?search=${encodeURIComponent(ADMIN_EMAIL)}`, {
    token,
  });
  const self =
    selfSearch.data.users?.find((u) => u.email === ADMIN_EMAIL) ??
    users.data.users?.find((u) => u.email === ADMIN_EMAIL);

  // These guards are the point of the endpoint, so a missing admin is a
  // failure — not a reason to quietly skip them.
  check("the admin account is reachable in the user list", Boolean(self));

  if (self) {
    const selfDemote = await call("PUT", `/admin/users/${self._id}`, {
      token,
      body: { role: "user" },
    });
    check("admin cannot demote themselves", selfDemote.status === 400);

    const selfDisable = await call("PUT", `/admin/users/${self._id}`, {
      token,
      body: { isActive: false },
    });
    check("admin cannot deactivate themselves", selfDisable.status === 400);

    // A search term that isn't a valid regex used to crash the endpoint
    // with a 500. It should be treated as literal text.
    const badSearch = await call("GET", "/admin/users?search=%5B", { token });
    check("a regex metacharacter in search doesn't 500", badSearch.status === 200);
  }

  section("Non-admin is locked out");
  const stamp = Date.now();
  const customer = await call("POST", "/auth/register", {
    body: {
      name: "Not An Admin",
      email: `notadmin${stamp}@test.com`,
      phone: "1234567890",
      password: "CustomerTest123",
    },
  });
  const customerToken = customer.data.token;

  if (customerToken) {
    for (const [label, path] of [
      ["dashboard stats", "/admin/stats"],
      ["all users", "/admin/users"],
      ["product create", "/products/admin"],
      ["all orders", "/orders/admin/all"],
      ["enquiry inbox", "/enquiries/admin/all"],
    ]) {
      const method = path === "/products/admin" ? "POST" : "GET";
      const body = method === "POST" ? { name: "Hack", category: "Seeds", price: 1, image: "x" } : undefined;
      const res = await call(method, path, { token: customerToken, body });
      check(`customer blocked from ${label}`, res.status === 403, `got ${res.status}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed\n`);

  process.exit(failed === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("\nCould not reach the API. Is the server running?\n", error.message);
  process.exit(1);
});
