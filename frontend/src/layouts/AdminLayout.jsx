import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Mail,
  Users,
  FileText,
  Menu,
  LogOut,
  Store,
  Leaf,
  Bell,
  Ticket,
  Truck,
  ShoppingCart as CartIcon,
  Boxes,
} from "lucide-react";

import useAuthStore from "../store/authStore";
import { getEnquiries } from "../api/enquiryApi";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/enquiries", label: "Enquiries", icon: Mail, badge: "enquiries" },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck },
  { to: "/admin/purchases", label: "Purchases", icon: CartIcon },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/blog", label: "Blog posts", icon: FileText },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Surface the number of unanswered enquiries in the sidebar.
  useEffect(() => {
    let cancelled = false;

    getEnquiries({ status: "new", limit: 1 })
      .then((data) => {
        if (!cancelled) setUnread(data.total ?? 0);
      })
      .catch(() => {
        // A failed badge count shouldn't break the panel.
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-950 text-brand-100">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Leaf size={21} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-white">
            Kanisha Enterprises
          </p>
          <p className="text-[11px] font-medium uppercase tracking-widest text-brand-400">
            Admin panel
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-300 ${
                isActive
                  ? "bg-brand-600 text-white shadow-lg"
                  : "text-brand-200 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="admin-active"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-wheat-300"
                  />
                )}

                <Icon size={18} className="shrink-0" />
                <span className="flex-1">{label}</span>

                {badge === "enquiries" && unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay-500 px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-brand-200 transition hover:bg-white/10 hover:text-white"
        >
          <Store size={18} />
          View storefront
        </Link>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 hover:text-red-200"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-[95] bg-sand-950/60 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed inset-y-0 left-0 z-[96] w-72 lg:hidden"
              aria-label="Admin navigation"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-sand-700 transition hover:bg-sand-100 lg:hidden"
              aria-label="Open admin menu"
            >
              <Menu size={22} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-sand-900">
                {NAV.find((n) =>
                  n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
                )?.label ?? "Admin"}
              </p>
              <p className="truncate text-xs text-sand-500">
                {user?.name} · {user?.email}
              </p>
            </div>

            {unread > 0 && (
              <Link
                to="/admin/enquiries"
                className="relative rounded-xl p-2.5 text-sand-600 transition hover:bg-sand-100"
                aria-label={`${unread} new enquiries`}
              >
                <Bell size={19} />
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay-600 px-1 text-[9px] font-bold text-white">
                  {unread}
                </span>
              </Link>
            )}
          </div>
        </header>

        {/* Page */}
        <main className="p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
