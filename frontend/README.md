# Kanisha Enterprises — Frontend

React 19 + Vite 8 + Tailwind CSS 4 storefront and admin panel.

The backend lives in `../backend`. See the [project README](../README.md) for
full setup instructions.

## Commands

```bash
npm run dev      # dev server on :5173
npm run build    # production build to dist/
npm run lint     # ESLint
npm run preview  # serve the production build locally
```

```bash
node scripts/checkIcons.mjs   # verify every lucide-react import resolves
```

## What you need to configure

`frontend/.env`

```
VITE_API_URL=http://localhost:5000/api
```

> ⚠️ Anything prefixed with `VITE_` is compiled into the JavaScript sent to the
> browser — it is **public**. Never put a secret here. The backend keeps its
> Razorpay keys, JWT secret and database password in `backend/.env`, which is
> git-ignored.

## What you need to edit

**`src/config/business.js`** — the single source of truth for the shop's name,
phone, email, address, opening hours and social links. These appear in the
header, footer, contact page, checkout and order pages. Leaving a field empty
hides it everywhere.

**`src/index.css`** — the `@theme` block at the top holds every colour, font,
shadow and easing used in the design system. Change `--color-brand-*` to
recolour the whole site.

## Structure

```
src/
├── api/              One module per resource, each a thin wrapper over Axios
├── components/
│   ├── ui/           Primitives: Button-ish bits, Toast, Modal patterns,
│   │                 Rating, Pagination, Skeleton, EmptyState, Reveal…
│   ├── Navbar.jsx    Search, wishlist, cart, account menu
│   ├── Footer.jsx
│   ├── CartDrawer.jsx
│   ├── ProductCard.jsx
│   ├── PageTransition.jsx  Cross-fade between routes
│   └── BrandIcons.jsx      Facebook/Instagram/YouTube/WhatsApp SVG
├── config/business.js
├── data/products.js   Category tiles + icon lookup
├── layouts/           MainLayout (storefront), AdminLayout (sidebar)
├── pages/
│   └── admin/         Admin pages
├── store/             Zustand: auth, cart + wishlist
├── App.jsx            Routes, all lazy-loaded
└── index.css          Design tokens, keyframes, utilities
```

## Conventions

- **Money comes from the server.** Cart items store a display price only;
  the real total is recalculated on the backend at checkout.
- **Filter state lives in the URL** on public listing pages, so views are
  shareable and survive a refresh.
- **Every page is lazy-loaded** via `React.lazy`, wrapped in a single
  `<Suspense>`. This keeps the initial bundle small.
- **Motion respects `prefers-reduced-motion`.** `Reveal` and `Hero` check
  `useReducedMotion()` and render final state immediately when it's set.
- **Images fail gracefully.** `ProductImage` swaps to a tinted placeholder;
  blog covers swap to a branded panel.
