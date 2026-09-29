# Kanisha Enterprises

A complete online shop for an agricultural inputs business — seeds, fertilisers,
pesticides, fungicides, herbicides and farm tools.

Customers can browse, search, add to a cart, check out (Cash on Delivery or
Razorpay), track orders and review delivered products. The shop owner gets a
full admin panel to manage the catalogue, orders, enquiries, customers and blog.

---

## Contents

- [What works](#what-works)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Creating the admin account](#creating-the-admin-account)
- [Project layout](#project-layout)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deploying](#deploying)
- [Before going live — checklist](#before-going-live--checklist)
- [Known limitations](#known-limitations)

---

## What works

### Storefront

| Page | Route | What it does |
|---|---|---|
| Home | `/` | Hero, categories, featured products, seasonal guide, why-us, testimonials |
| Products | `/products` | Filter by category/subcategory/availability, search, sort, paginate. Filters live in the URL so a view can be shared or bookmarked. |
| Product detail | `/products/:slug` | Gallery, price, stock, quantity, highlights, usage notes, specifications, reviews, related products |
| Blog | `/blog` | Article list with tag filter and search |
| Article | `/blog/:slug` | Full article, reading time, share/copy-link, related posts |
| About | `/about` | Story timeline, values, promises |
| Contact | `/contact` | Working enquiry form (stored in the database) with spam honeypot |
| Cart | `/cart` | Edit quantities, remove items, free-delivery progress |
| Checkout | `/checkout` | Saved addresses, address book, coupon code, COD or Razorpay |
| Forgot password | `/forgot-password` | Request a reset link by email |
| Reset password | `/reset-password?token=…` | Set a new password from a reset link |
| Order success | `/order-success/:id` | Confirmation, what-happens-next timeline, receipt |
| Orders | `/orders` | Order history with status filters |
| Order detail | `/orders/:id` | Progress tracker, items, totals, address, cancel, write reviews |
| Wishlist | `/wishlist` | Saved products, move all to cart |
| Profile | `/profile` | Personal details, saved addresses, change password |
| Dashboard | `/dashboard` | Order stats, recent orders, quick links |
| 404 | any unknown route | Branded not-found page |

### Admin panel (`/admin`)

| Section | What it does |
|---|---|
| Dashboard | Revenue (all-time and last 30 days, with trend), order counts, low-stock alerts, best sellers, order-status breakdown |
| Orders | List/filter/search, change status through the full lifecycle, view full order details |
| Products | Full CRUD, stock levels, pricing, discounts, visibility, featured flag, URL slug |
| Enquiries | Inbox from the contact form, unread badge, mark read / reply / archive / delete |
| Customers | List/search, promote to admin, deactivate accounts |
| Discount codes | Create and edit codes, pause/reactivate instead of deleting, set minimum order, usage limit, expiry date and category restrictions |
| Blog posts | Create, edit, publish/unpublish, delete |

### Business logic worth knowing

- **Stock is reserved when an order is placed** and returned if it's cancelled.
  You can't oversell.
- **Prices are always recalculated on the server.** The browser only ever sends
  *which* product and *how many* — never a price. Tampering with the request
  cannot change a total.
- **The checkout total comes from the server, not the browser.** Applying a
  discount code calls `POST /api/coupons/validate`, which prices the cart with
  the same function (`quoteOrder`) that creates the order. The figure a
  customer confirms is by construction the figure they are charged. Delivery
  thresholds are read from the API too, so they can't drift out of sync with
  the backend.
- **A discount can never exceed the order value**, so a total can never go
  negative.
- **Password-reset tokens are single-use and expire after an hour.** Only a
  SHA-256 hash is stored, so a database leak can't be replayed as a reset
  link. Requesting a reset for an unknown email returns the same response as a
  known one, so the endpoint can't be used to discover customers.
- **Only customers with a delivered order can review** a product, one review
  each, and the product's rating is recalculated automatically.
- **Soft-deleted products** disappear from the shop but stay attached to past
  orders, so order history never breaks.
- **Deleting a product whose slug is taken** is impossible; a numeric suffix is
  added automatically so two products can share a name.
- **Login throttling counts only failed attempts**, so several staff on one shop
  computer never lock each other out.

---

## Tech stack

**Backend** — Node.js, Express 5, Mongoose (MongoDB Atlas), JWT, bcrypt.
No test framework dependency: the suites are plain Node scripts.

**Frontend** — React 19, Vite 8, Tailwind CSS 4, React Router 7, Zustand,
Axios, Framer Motion, lucide-react.

---

## Getting started

**Requirements:** Node.js 18+ and a MongoDB database (a free MongoDB Atlas
cluster is fine).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit .env — see below
npm run dev               # http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

### 3. Load sample data (optional but recommended)

```bash
cd backend
npm run seed          # 25 products
npm run seed:blogs    # 6 blog posts
npm run seed:coupons  # HARVEST10, FARMER200, SEEDS5
```

### 4. Create your admin account

```bash
cd backend
node seedAdmin.js --email=you@example.com --name="Your Name"
```

It generates a strong password and prints it **once** — save it. Or supply your
own:

```bash
node seedAdmin.js --email=you@example.com --name="Your Name" --password="YourPassword"
```

Log in at `/login`, then open **/admin**.

---

## Environment variables

### `backend/.env`

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `5000` | API port |
| `NODE_ENV` | no | `development` | Set to `production` when deployed. Stops the reset token ever being returned in an API response. |
| `MONGODB_URI` | **yes** | — | MongoDB connection string |
| `JWT_SECRET` | **yes** | — | Generate one (see below) |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `CLIENT_URL` | no | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `SHIPPING_CHARGE` | no | `49` | Flat delivery fee in ₹ |
| `FREE_SHIPPING_ABOVE` | no | `999` | Order value (₹) for free delivery |
| `PASSWORD_RESET_TTL_MINUTES` | no | `60` | How long a reset link stays valid |
| `RAZORPAY_KEY_ID` | no | *(blank)* | Leave blank for COD-only |
| `RAZORPAY_KEY_SECRET` | no | *(blank)* | Leave blank for COD-only |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` / `ADMIN_PHONE` | no | *(blank)* | Defaults for `npm run seed:admin` |
| `API_URL` | no | `http://localhost:5000/api` | Only used by the test scripts |

`backend/.env.example` contains all of these, grouped and annotated.

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### `frontend/.env`

| Variable | Notes |
|---|---|
| `VITE_API_URL` | API base URL. Defaults to `http://localhost:5000/api` |

---

## Project layout

```
Kanisha_Enterprises/
├── backend/
│   ├── config/db.js               Mongo connection
│   ├── models/                    User, Product, Order, Review, Enquiry, Coupon, Blog
│   ├── controllers/               Request handlers per resource
│   ├── routes/                    URL definitions
│   ├── middleware/                auth, admin, rate limiting, error handling
│   ├── utils/                     pricing, validation, regex escaping, index setup
│   ├── scripts/                   test + maintenance scripts
│   ├── seed.js / seedBlogs.js / seedCoupons.js / seedAdmin.js
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── api/                   One module per resource
    │   ├── components/            Shared UI (ui/ holds primitives)
    │   ├── layouts/               MainLayout, AdminLayout
    │   ├── pages/                 Public + customer pages
    │   │   └── admin/             Admin pages
    │   ├── store/                 Zustand: auth, cart + wishlist
    │   ├── config/business.js     ⚠️  Shop name, phone, address, hours
    │   └── index.css              Design tokens + keyframes
    └── scripts/checkIcons.mjs
```

### Where to change things

| To change | Edit |
|---|---|
| Shop name, phone, address, opening hours, social links | `frontend/src/config/business.js` |
| Colours, fonts, shadows, animations | `frontend/src/index.css` (`@theme` block) |
| Delivery charge / free-delivery threshold | `backend/.env` |
| Homepage testimonials | `frontend/src/components/Testimonials.jsx` |
| Homepage category tiles | `frontend/src/data/products.js` |

---

## API reference

All responses are `{ success, ... }`. Errors are
`{ success: false, message }` with a meaningful HTTP status.

### Public

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/products` | List. `?category=&subcategory=&search=&sort=&page=&limit=&inStock=&featured=` |
| `GET` | `/api/products/categories` | Categories with live product counts |
| `GET` | `/api/products/:idOrSlug` | Product + reviews + related |
| `GET` | `/api/blogs` | List. `?tag=&search=&page=&limit=` |
| `GET` | `/api/blogs/tags` | All published tags |
| `GET` | `/api/blogs/:slug` | One post + related |
| `GET` | `/api/reviews/product/:id` | Reviews for a product |
| `POST` | `/api/enquiries` | Contact form (rate limited) |
| `GET` | `/api/payments/config` | Whether Razorpay is enabled |

### Auth (`Authorization: Bearer <token>`)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Current user |
| `PUT` | `/api/auth/me` | Update profile |
| `PUT` | `/api/auth/password` | Change password |
| `POST/PUT/DELETE` | `/api/auth/addresses[/:id]` | Address book |

### Customer (authenticated)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/orders` | Place a COD order |
| `GET` | `/api/orders` | Own orders. `?status=&page=` |
| `GET` | `/api/orders/:id` | One order (owner or admin) |
| `PUT` | `/api/orders/:id/cancel` | Cancel, returning stock |
| `POST` | `/api/reviews` | Review a delivered product |
| `PUT/DELETE` | `/api/reviews/:id` | Edit or remove own review |
| `POST` | `/api/payments/create-order` | Start a Razorpay payment |
| `POST` | `/api/payments/verify` | Confirm payment by HMAC signature |
| `POST` | `/api/payments/cancel` | Abandon a payment, releasing stock |

### Admin (authenticated + `role: "admin"`)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/stats` | Dashboard figures |
| `GET/PUT` | `/api/admin/users[/:id]` | Customers, roles, activation |
| `GET/POST/DELETE` | `/api/admin/coupons[/:id]` | Discount codes |
| `GET` | `/api/orders/admin/all` | All orders. `?status=&search=&page=` |
| `PUT` | `/api/orders/admin/:id/status` | Change order status |
| `GET` | `/api/products/admin/all` | Products incl. hidden |
| `POST/PUT/DELETE` | `/api/products/admin[/:id]` | Product CRUD (delete is soft) |
| `GET` | `/api/enquiries/admin/all` | Enquiry inbox |
| `PUT/DELETE` | `/api/enquiries/admin/:id[...]` | Enquiry status / delete |
| `GET` | `/api/blogs/admin/all` | Posts incl. drafts |
| `POST/PUT/DELETE` | `/api/blogs[/:id]` | Blog CRUD |

**Order lifecycle:** `pending → confirmed → packed → shipped → delivered`,
plus `cancelled` from any pre-shipment state. Marking a COD order delivered
automatically marks it paid.

---

## Testing

The backend has four runnable suites that exercise real HTTP requests. Start
the server first, then run them in another terminal.

```bash
cd backend
npm run dev              # terminal 1

npm test                 # terminal 2 — 38 checks, customer flows
npm run test:admin       #           — 41 checks, admin flows + access control
npm run test:phase1      #           — 41 checks, coupons + password reset
npm run test:ratelimit   #           — 13 checks, throttling
npm run test:all         #           — customer + admin + phase 1
```

What they cover, among other things:

- Registration, login, wrong passwords, duplicate emails, validation
- **That a customer cannot reach any admin endpoint** (403 on all of them)
- **That the server ignores client-supplied prices**
- **That the discount shown at checkout equals the discount charged**
- That a coupon is refused for the right reason (expired, over the minimum
  order, fully claimed) rather than silently ignored
- That a password-reset link is single-use, expires, and can't reveal whether
  an email is registered
- That an admin can't demote or deactivate their own account
- That orders cannot be cancelled twice, or cancelled after delivery
- That one customer cannot read another customer's order
- That a review is rejected without a delivered purchase
- That search input like `(a+)+b` or `[` doesn't crash the server
- That failed logins are throttled but correct ones never are

`npm run test:ratelimit` deliberately trips the limiter. Wait ~15 minutes (or
restart the server) before re-running the other suites, otherwise they'll
receive `429` and report skips.

### Maintenance scripts

```bash
npm run db:status              # counts per collection
npm run db:inventory           # READ-ONLY: every row, marked test vs business
npm run db:preview             # READ-ONLY: what a clean-up would leave behind
npm run db:clean -- --dry      # preview exactly what would be deleted
npm run db:clean               # remove test data (asks first; --yes to skip)
npm run db:clean -- --all      # also delete real customers/orders
```

`db:inventory`, `db:preview` and `db:clean --dry` never write. Run one of those
first if you want to see what a clean-up would touch before letting it near
real orders. `db:clean` refuses to delete admin accounts in any mode.

Running any test suite creates throwaway rows, so run `db:clean` after testing
if the database is going somewhere visible.

### Frontend

```bash
cd frontend
npm run lint                  # ESLint — must be clean
node scripts/checkIcons.mjs   # verifies every lucide import resolves
npm run build                 # production build
```

---

## Deploying

### Backend

Works on any Node host (Render, Railway, Fly.io, a VPS).

1. Set the environment variables from the table above.
2. **Set `CLIENT_URL` to your real frontend domain** or the browser will be
   blocked by CORS.
3. `npm start`

Indexes are created automatically on boot, so `unique: true` constraints in the
schemas are actually enforced.

### Frontend

Works on Vercel, Netlify or Cloudflare Pages.

1. Set `VITE_API_URL=https://your-api.com/api`
2. Build command `npm run build`, output directory `dist`

### ⚠️ SPA routing

The app uses client-side routes, so a hard refresh on `/products/anything` must
serve `index.html` rather than 404. Add a rewrite:

- **Vercel** — create `frontend/vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- **Netlify** — add to `frontend/public/_redirects`:
  ```
  /*  /index.html  200
  ```

---

## Before going live — checklist

- [ ] **Rotate the MongoDB password and `JWT_SECRET`.** They were stored in
      plain text in `backend/.env`. `.gitignore` now excludes `.env`, but
      anything already committed stays in git history — rotate regardless.
      In Atlas: *Database Access → edit user → reset password*.
- [ ] Fill in `frontend/src/config/business.js` — the phone, email and address
      are still placeholders.
- [ ] Replace the sample testimonials in `Testimonials.jsx` with real quotes.
- [ ] Add real product photos to `frontend/public/products/`. Until then the
      site shows a branded placeholder per product rather than a broken image.
- [ ] Add blog cover images to `frontend/public/blog/`.
- [ ] Set `CLIENT_URL` to your production frontend URL.
- [ ] Add Razorpay keys, or leave them blank to run Cash-on-Delivery only.
- [ ] Run `npm run seed:all` on production, or add products through `/admin`.
- [ ] Consider a free HTTPS certificate — Atlas, Vercel and Netlify all
      provide one automatically.
- [ ] Back up the Atlas cluster (scheduled snapshots).

---

## Known limitations

Honest about what this doesn't do yet:

- **Rate limiting is in-memory.** It resets when the server restarts and isn't
  shared between instances. Fine for a single server; if you scale to two or
  more, swap `middleware/rateLimiter.js` for a Redis-backed store.
- **No email or SMS.** Orders are confirmed by phone. Adding transactional
  email is the single highest-value next feature.
- **No image uploads.** Product images are referenced by path
  (`/products/foo.jpg`) rather than uploaded through the admin. A
  Cloudinary/S3 upload widget would fix this.
- **The newsletter form is front-end only.** It confirms locally and doesn't
  store or send anything — it needs a mailing-list backend.
- **Product images have no resizing or CDN.** Serving a 2 MB photo as a
  thumbnail will be slow on mobile data.
- **The blog editor is plain text.** Paragraphs are split on blank lines and
  short all-caps lines become subheadings. A rich-text editor would be better.
- **No inventory purchase records** — stock is a single number you edit by
  hand, not a ledger of deliveries and returns.
