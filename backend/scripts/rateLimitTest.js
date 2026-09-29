/**
 * Isolated test for the rate limiter.
 *
 * Kept separate from the main smoke test because it deliberately trips the
 * limiter, which would then block the rest of the suite.
 *
 *   npm run dev   (in another shell)
 *   node scripts/rateLimitTest.js
 *
 * Then wait ~15 minutes before re-running, so the buckets clear.
 */
const BASE = process.env.API_URL || "http://localhost:5000/api";

let passed = 0;
let failed = 0;

const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
};

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) };
};

const run = async () => {
  console.log(`Rate limiter test against ${BASE}`);
  console.log("This intentionally trips the limiter. Wait ~15 min before re-running.\n");

  // ------------------------------------------------------------------
  // 1. Sign-in: only FAILED attempts should count.
  // ------------------------------------------------------------------
  console.log("Sign-in attempts (limit: 10 failures per 15 min)");

  const email = `ratelimit${Date.now()}@test.com`;

  // Register one valid account to test the "success clears the slate" rule.
  const reg = await post("/auth/register", {
    name: "Rate Test",
    email,
    phone: "1234567890",
    password: "RateTest12345",
  });
  check("registered a test account", reg.status === 201, `got ${reg.status}`);

  // Several CORRECT logins must never accumulate towards the limit.
  const goodStatuses = [];
  for (let i = 0; i < 12; i++) {
    goodStatuses.push((await post("/auth/login", { email, password: "RateTest12345" })).status);
  }
  const goodThrottled = goodStatuses.filter((s) => s === 429).length;
  const goodOk = goodStatuses.filter((s) => s === 200).length;

  check("correct logins are never throttled", goodThrottled === 0, `${goodThrottled} x 429`);
  check("all 12 correct logins succeeded", goodOk === 12, `${goodOk} x 200`);

  // Now hammer it with wrong passwords.
  const badStatuses = [];
  for (let i = 0; i < 14; i++) {
    badStatuses.push((await post("/auth/login", { email, password: "DefinitelyWrong1" })).status);
  }

  const rejected = badStatuses.filter((s) => s === 401).length;
  const throttled = badStatuses.filter((s) => s === 429).length;

  check("wrong passwords are rejected", rejected > 0, `${rejected} x 401`);
  check("brute force is eventually throttled", throttled > 0, `${throttled} x 429`);
  check("throttling starts before all attempts pass", throttled < badStatuses.length);

  // While locked out, even the CORRECT password must be refused.
  const lockedOut = await post("/auth/login", { email, password: "RateTest12345" });
  check("locked out even with the right password", lockedOut.status === 429, `got ${lockedOut.status}`);

  // ------------------------------------------------------------------
  // 2. Contact form: every request counts (no auth involved).
  // ------------------------------------------------------------------
  console.log("\nContact form (limit: 8 requests per 15 min)");

  const enquiryStatuses = [];
  for (let i = 0; i < 12; i++) {
    enquiryStatuses.push(
      (
        await post("/enquiries", {
          name: "Rate Test",
          email: "ratetest@example.com",
          message: "This is a rate limiter test message, not a real enquiry.",
        })
      ).status
    );
  }

  const enquiryThrottled = enquiryStatuses.filter((s) => s === 429).length;
  const enquiryCreated = enquiryStatuses.filter((s) => s === 201).length;

  check("some enquiries are accepted", enquiryCreated > 0, `${enquiryCreated} x 201`);
  check("contact form is throttled", enquiryThrottled > 0, `${enquiryThrottled} x 429`);
  check("contact form limit is enforced before the limit", enquiryCreated <= 8, `${enquiryCreated} accepted`);

  // ------------------------------------------------------------------
  // 3. Response shape.
  // ------------------------------------------------------------------
  console.log("\nResponse shape");

  const throttledRes = await post("/enquiries", {
    name: "Rate Test",
    email: "ratetest@example.com",
    message: "One more to confirm the throttled response shape.",
  });

  check("throttled response is clean JSON", typeof throttledRes.body.success === "boolean");
  check("throttled response has a message", typeof throttledRes.body.message === "string");
  check("throttled response sets Retry-After", !!throttledRes.headers.get("retry-after"));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("Could not reach the API. Is the server running?\n", error.message);
  process.exit(1);
});
