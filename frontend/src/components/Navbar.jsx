import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  Search,
  Heart,
  ShoppingCart,
  UserRound,
  Leaf,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ChevronDown,
  Loader2,
  ArrowRight,
} from "lucide-react";

import useAuthStore, { selectIsAdmin } from "../store/authStore";
import useCartStore, { selectCartCount } from "../store/cartStore";
import { getProducts } from "../api/productApi";
import ProductImage from "./ui/ProductImage";

const NAV_LINKS = [
  { name: "Home", path: "/" },
  { name: "Products", path: "/products" },
  { name: "Blog", path: "/blog" },
  { name: "About", path: "/about" },
  { name: "Contact", path: "/contact" },
];

/** Count bubble on the cart / wishlist buttons. */
function CountBadge({ count }) {
  if (!count) return null;

  return (
    <motion.span
      key={count}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-clay-600 px-1 text-[10px] font-bold text-white ring-2 ring-white"
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

function SearchBox({ onNavigate, className = "" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const boxRef = useRef(null);
  const navigate = useNavigate();

  // Debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getProducts({ search: term, limit: 5 });
        setResults(data.products || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Close the results when clicking outside.
  useEffect(() => {
    const onClickAway = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const goToProduct = (product) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onNavigate?.();
    navigate(`/products/${product.slug || product._id}`);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const term = query.trim();

    if (!term) return;

    setOpen(false);
    onNavigate?.();
    navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submitSearch} role="search">
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
        />

        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search seeds, fertilisers, tools…"
          aria-label="Search products"
          className="w-full rounded-full border border-sand-200 bg-sand-50 py-2.5 pl-10 pr-10 text-sm text-sand-900 placeholder:text-sand-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
        />

        {loading && (
          <Loader2
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-brand-500"
          />
        )}
      </form>

      <AnimatePresence>
        {open && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-lift"
          >
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-sand-500">
                {loading ? "Searching…" : `No products match "${query.trim()}"`}
              </p>
            ) : (
              <>
                <ul className="max-h-80 overflow-y-auto p-2">
                  {results.map((product) => (
                    <li key={product._id}>
                      <button
                        onClick={() => goToProduct(product)}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-sand-50"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                          <ProductImage
                            src={product.image}
                            alt=""
                            name={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold text-sand-900">
                            {product.name}
                          </p>
                          <p className="text-xs text-sand-500">{product.category}</p>
                        </div>

                        <span className="shrink-0 text-sm font-bold text-brand-700">
                          ₹{product.effectivePrice ?? product.price}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={submitSearch}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-sand-200 bg-sand-50 py-3 text-sm font-semibold text-brand-700 transition hover:bg-sand-100"
                >
                  See all results <ArrowRight size={15} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar({ onOpenCart }) {
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAdmin = useAuthStore(selectIsAdmin);

  const cartCount = useCartStore(selectCartCount);
  const wishlistCount = useCartStore((s) => s.wishlist.length);

  const accountRef = useRef(null);

  // Add a shadow once the page has scrolled, so the header lifts off the content.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the account menu on an outside click.
  useEffect(() => {
    const onClickAway = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const closeMenu = () => setMobileOpen(false);

  const handleLogout = () => {
    clearAuth();
    setAccountOpen(false);
    closeMenu();
    navigate("/");
  };

  return (
    <>
      <header
        className={`sticky top-0 z-[80] border-b transition-all duration-300 ${
          scrolled
            ? "border-sand-200 bg-white/85 shadow-soft backdrop-blur-xl"
            : "border-transparent bg-white/60 backdrop-blur-sm"
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" onClick={closeMenu} className="group flex shrink-0 items-center gap-2.5">
            <motion.span
              whileHover={{ rotate: -12, scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-glow"
            >
              <Leaf size={23} />
            </motion.span>

            <span className="hidden sm:block">
              <span className="block font-display text-lg font-bold leading-tight text-sand-900">
                Kanisha Enterprises
              </span>
              <span className="block text-[11px] font-medium uppercase tracking-widest text-brand-600">
                Growing Together
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="ml-4 hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === "/"}
                className={({ isActive }) =>
                  `nav-underline text-sm font-semibold transition-colors ${
                    isActive
                      ? "nav-underline-active text-brand-700"
                      : "text-sand-600 hover:text-brand-700"
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </div>

          {/* Desktop search */}
          <div className="ml-auto hidden max-w-xs flex-1 xl:block">
            <SearchBox onNavigate={closeMenu} />
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 xl:ml-0">
            {/* Wishlist */}
            <Link
              to="/wishlist"
              className="relative hidden rounded-xl p-2.5 text-sand-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
              aria-label={`Wishlist, ${wishlistCount} items`}
            >
              <Heart size={20} />
              <CountBadge count={wishlistCount} />
            </Link>

            {/* Cart */}
            <button
              onClick={onOpenCart}
              className="relative rounded-xl p-2.5 text-sand-600 transition hover:bg-brand-50 hover:text-brand-700"
              aria-label={`Open cart, ${cartCount} items`}
            >
              <ShoppingCart size={20} />
              <CountBadge count={cartCount} />
            </button>

            {/* Account */}
            {token ? (
              <div ref={accountRef} className="relative hidden sm:block">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-sand-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-brand-300 hover:shadow-soft"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </span>
                  <span className="max-w-24 truncate text-sm font-semibold text-sand-800">
                    {user?.name?.split(" ")[0] || "Account"}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-sand-400 transition-transform duration-300 ${
                      accountOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-sand-200 bg-white p-2 shadow-lift"
                      role="menu"
                    >
                      <div className="border-b border-sand-200 px-3 pb-3 pt-2">
                        <p className="truncate text-sm font-bold text-sand-900">
                          {user?.name}
                        </p>
                        <p className="truncate text-xs text-sand-500">{user?.email}</p>
                      </div>

                      <div className="pt-1.5">
                        {[
                          { to: "/dashboard", icon: LayoutDashboard, label: "My dashboard" },
                          { to: "/orders", icon: Package, label: "My orders" },
                          { to: "/wishlist", icon: Heart, label: "Wishlist" },
                          { to: "/profile", icon: UserRound, label: "Profile & addresses" },
                        ].map(({ to, icon: Icon, label }) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-sand-700 transition hover:bg-brand-50 hover:text-brand-800"
                            role="menuitem"
                          >
                            <Icon size={17} className="text-sand-400" />
                            {label}
                          </Link>
                        ))}

                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setAccountOpen(false)}
                            className="mt-1 flex items-center gap-2.5 rounded-xl bg-clay-50 px-3 py-2.5 text-sm font-semibold text-clay-700 transition hover:bg-clay-100"
                            role="menuitem"
                          >
                            <Settings size={17} />
                            Admin panel
                          </Link>
                        )}

                        <button
                          onClick={handleLogout}
                          className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                          role="menuitem"
                        >
                          <LogOut size={17} />
                          Log out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-shine hidden items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 hover:shadow-glow sm:inline-flex"
              >
                <UserRound size={17} />
                Login
              </Link>
            )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-xl p-2.5 text-sand-700 transition hover:bg-sand-100 lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile panel */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-sand-200 bg-white lg:hidden"
            >
              <div className="space-y-4 px-4 py-5 sm:px-6">
                <SearchBox onNavigate={closeMenu} />

                <nav className="flex flex-col">
                  {NAV_LINKS.map((link, i) => (
                    <motion.div
                      key={link.path}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.05 }}
                    >
                      <NavLink
                        to={link.path}
                        end={link.path === "/"}
                        onClick={closeMenu}
                        className={({ isActive }) =>
                          `block border-b border-sand-100 py-3 text-base font-semibold transition ${
                            isActive ? "text-brand-700" : "text-sand-700"
                          }`
                        }
                      >
                        {link.name}
                      </NavLink>
                    </motion.div>
                  ))}
                </nav>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    to="/wishlist"
                    onClick={closeMenu}
                    className="relative flex flex-1 items-center justify-center gap-2 rounded-xl border border-sand-200 py-3 text-sm font-semibold text-sand-700"
                  >
                    <Heart size={17} />
                    Wishlist
                    <CountBadge count={wishlistCount} />
                  </Link>

                  {token ? (
                    <Link
                      to="/dashboard"
                      onClick={closeMenu}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sand-200 py-3 text-sm font-semibold text-sand-700"
                    >
                      <LayoutDashboard size={17} />
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      onClick={closeMenu}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sand-200 py-3 text-sm font-semibold text-sand-700"
                    >
                      <UserRound size={17} />
                      Login
                    </Link>
                  )}
                </div>

                {token && (
                  <div className="flex gap-2">
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={closeMenu}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-clay-50 py-3 text-sm font-semibold text-clay-700"
                      >
                        <Settings size={17} />
                        Admin panel
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600"
                    >
                      <LogOut size={17} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
