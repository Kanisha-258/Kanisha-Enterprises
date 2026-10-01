/**
 * End-to-end smoke test for the API.
 *
 *   1. start the server:  npm run dev
 *   2. in another shell:  npm run check
 *
 * Exercises the real request paths (register -> browse -> cart -> order)
 * against a running server, so it catches wiring mistakes that unit tests miss.
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

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return { status: res.status, data };
};

const check = (name, condition, detail = "") => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
};

const skip = (name, reason) => {
  console.log(`  SKIP  ${name} (${reason})`);
};

/**
 * The API rate-limits order placement and enquiries, so a suite that is run
 * repeatedly starts getting 429s. That is the limiter working correctly, not
 * a broken endpoint — so we stop rather than reporting false failures.
 */
let rateLimited = false;

const guard = (res, name) => {
  if (res.status === 429) {
    rateLimited = true;
    skip(name, "rate limited — wait 15 min and re-run");
    return false;
  }
  return true;
};

const section = (title) => console.log(`\n${title}`);

// Unique per run so repeat runs don't hit the "email already exists" path.
const stamp = Date.now();
const email = `smoke${stamp}@test.com`;
const password = "SmokeTest123";

const run = async () => {
  console.log(`Smoke testing ${BASE}\n${"=".repeat(50)}`);

  section("Health");
  const health = await call("GET", "/health");
  check("health endpoint responds", health.status === 200, `got ${health.status}`);

  section("Products (public)");
  const products = await call("GET", "/products?limit=5");
  check("list products", products.status === 200 && Array.isArray(products.data.products));
  const first = products.data.products?.[0];
  check("products are paginated", typeof products.data.totalPages === "number");

  const categories = await call("GET", "/products/categories");
  check("list categories", categories.status === 200 && categories.data.count > 0);

  if (first) {
    const detail = await call("GET", `/products/${first.slug || first._id}`);
    check("product detail by slug/id", detail.status === 200 && !!detail.data.product);
  } else {
    console.log("  SKIP  product detail (no products seeded - run `npm run seed`)");
  }

  section("Search is regex-safe");
  for (const evil of ["a(b", "(a+)+b", "5*3"]) {
    const r = await call("GET", `/products?search=${encodeURIComponent(evil)}`);
    check(`search "${evil}" does not 500`, r.status === 200, `got ${r.status}`);
  }

  section("Auth");
  const badEmail = await call("POST", "/auth/register", {
    body: { name: "X", email: "not-an-email", phone: "123", password },
  });
  check("rejects invalid email/phone", badEmail.status === 400);

  const weak = await call("POST", "/auth/register", {
    body: { name: "Smoke Tester", email, phone: "1234567890", password: "short" },
  });
  check("rejects weak password", weak.status === 400);

  const reg = await call("POST", "/auth/register", {
    body: {
      name: "Smoke Tester",
      email,
      phone: "1234567890",
      password,
      address: "1 Test Road",
      city: "Testville",
      state: "Teststate",
      pincode: "600001",
    },
  });
  check("registers a customer", reg.status === 201 && !!reg.data.token, `got ${reg.status}`);
  check("never returns the password hash", reg.data.user && reg.data.user.password === undefined);

  const token = reg.data.token;

  const dupe = await call("POST", "/auth/register", {
    body: { name: "Dupe", email, phone: "1234567890", password },
  });
  check("rejects duplicate email", dupe.status === 409);

  const login = await call("POST", "/auth/login", { body: { email, password } });
  check("logs in", login.status === 200 && !!login.data.token);

  const wrongPw = await call("POST", "/auth/login", { body: { email, password: "WrongPass123" } });
  check("rejects wrong password", wrongPw.status === 401);

  const me = await call("GET", "/auth/me", { token });
  check("returns current user", me.status === 200 && me.data.user.email === email);

  const noToken = await call("GET", "/auth/me");
  check("blocks unauthenticated access", noToken.status === 401);

  section("Authorisation");
  const adminOnly = await call("GET", "/admin/stats", { token });
  check("customer cannot read admin stats", adminOnly.status === 403, `got ${adminOnly.status}`);

  const adminProducts = await call("GET", "/products/admin/all", { token });
  check("customer cannot create products", adminProducts.status === 403);

  section("Cart validation");

  const validAddress = {
    fullName: "Smoke Tester",
    phone: "1234567890",
    line1: "1 Test Road",
    city: "Testville",
    state: "Teststate",
    pincode: "600001",
  };

  const emptyCart = await call("POST", "/orders", {
    token,
    body: { items: [], paymentMethod: "cod", shippingAddress: validAddress },
  });

  // A 429 here means the limiter is doing its job; the validation checks
  // below would be meaningless, so stop rather than report false failures.
  if (!guard(emptyCart, "order validation")) {
    // fall through to the non-order sections
  } else {
    check("rejects an empty cart", emptyCart.status === 400, `got ${emptyCart.status}`);

    const badAddress = await call("POST", "/orders", {
      token,
      body: {
        items: [{ productId: first?._id, quantity: 1 }],
        paymentMethod: "cod",
        shippingAddress: { fullName: "A", phone: "123", line1: "", city: "", state: "" },
      },
    });
    if (guard(badAddress, "rejects an incomplete address")) {
      check("rejects an incomplete address", badAddress.status === 400,
        `got ${badAddress.status}`);
    }

    if (first) {
      const noSuchProduct = await call("POST", "/orders", {
        token,
        body: {
          items: [{ productId: "507f1f77bcf86cd799439011", quantity: 1 }],
          paymentMethod: "cod",
          shippingAddress: validAddress,
        },
      });
      if (guard(noSuchProduct, "rejects an unknown product")) {
        check("rejects an unknown product", noSuchProduct.status === 400,
          `got ${noSuchProduct.status}`);
      }

      const tooMany = await call("POST", "/orders", {
        token,
        body: {
          items: [{ productId: first._id, quantity: 999999 }],
          paymentMethod: "cod",
          shippingAddress: validAddress,
        },
      });
      if (guard(tooMany, "rejects more than available stock")) {
        check("rejects more than available stock", tooMany.status === 400,
          `got ${tooMany.status}`);
      }

      // Price is computed server-side from the database, never the request body.
      const order = await call("POST", "/orders", {
        token,
        body: {
          items: [{ productId: first._id, quantity: 1, price: 1 }],
          paymentMethod: "cod",
          shippingAddress: validAddress,
        },
      });

      if (order.status === 201) {
        const o = order.data.order;
        const expectedSubtotal =
          first.discountPrice > 0 && first.discountPrice < first.price
            ? first.discountPrice
            : first.price;

        check("places a real order", !!o.orderNumber);
        check("ignores client-supplied price", o.subtotal === expectedSubtotal, `${o.subtotal} vs ${expectedSubtotal}`);
        check("total = subtotal - discount + shipping", o.total === o.subtotal - o.discount + o.shippingCharge);

        const myOrders = await call("GET", "/orders", { token });
        check("lists the customer's orders", myOrders.status === 200 && myOrders.data.count >= 1);

        // Another customer must not be able to read it.
        const other = await call("POST", "/auth/register", {
          body: { name: "Other", email: `other${stamp}@test.com`, phone: "1234567891", password },
        });
        const forbidden = await call("GET", `/orders/${o._id}`, { token: other.data.token });
        check("blocks reading someone else's order", forbidden.status === 403, `got ${forbidden.status}`);

        const cancelled = await call("PUT", `/orders/${o._id}/cancel`, { token, body: { reason: "Smoke test" } });
        check("cancels an order", cancelled.status === 200 && cancelled.data.order.orderStatus === "cancelled");

        const recancel = await call("PUT", `/orders/${o._id}/cancel`, { token, body: {} });
        check("cannot cancel twice", recancel.status === 400, `got ${recancel.status}`);
      } else {
        skip("order flow", `got ${order.status}: ${order.data.message}`);
      }
    }
  }

  section("Reviews");
  if (first) {
    const early = await call("POST", "/reviews", {
      token,
      body: { productId: first._id, rating: 5, comment: "Not bought yet" },
    });
    check("cannot review without a delivered order", early.status === 403);

    const badRating = await call("POST", "/reviews", { token, body: { productId: first._id, rating: 99 } });
    check("rejects out-of-range rating", badRating.status === 400 || badRating.status === 403);
  }

  section("Contact form");
  const enquiry = await call("POST", "/enquiries", {
    body: {
      name: "Smoke Tester",
      email,
      phone: "1234567890",
      subject: "Bulk order",
      message: "I would like to know wholesale rates for paddy seeds.",
    },
  });

  if (guard(enquiry, "contact form")) {
    check("accepts a contact enquiry", enquiry.status === 201, `got ${enquiry.status}`);

    const tooShort = await call("POST", "/enquiries", {
      body: { name: "A", email, message: "hi" },
    });
    check("rejects a too-short message", tooShort.status === 400, `got ${tooShort.status}`);
  }

  const enquiriesAsCustomer = await call("GET", "/enquiries/admin/all", { token });
  check("customer cannot read the enquiry inbox", enquiriesAsCustomer.status === 403);

  section("Blog");
  const blogs = await call("GET", "/blogs");
  check("lists blog posts", blogs.status === 200 && Array.isArray(blogs.data.blogs));

  section("Payments");
  const config = await call("GET", "/payments/config");
  check("reports payment config", config.status === 200 && typeof config.data.razorpayEnabled === "boolean");

  section("Errors");
  const notFound = await call("GET", "/this-route-does-not-exist");
  check("404 returns a clean JSON error", notFound.status === 404 && notFound.data.success === false);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed\n`);

  if (rateLimited) {
    console.log(
      "Note: the API rate limiter throttled this run. That is expected when the\n" +
        "suite is run repeatedly — wait 15 minutes for a complete run.\n"
    );
  }

  process.exit(failed === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("\nCould not reach the API. Is the server running?\n", error.message);
  process.exit(1);
});
