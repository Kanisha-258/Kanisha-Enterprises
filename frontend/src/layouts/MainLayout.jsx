import { useState } from "react";
import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
import PageTransition from "../components/PageTransition";
import ScrollToTop from "../components/ScrollToTop";

function MainLayout() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <ScrollToTop />

      <Navbar onOpenCart={() => setCartOpen(true)} />

      <PageTransition>
        <main className="flex-1">
          <Outlet />
        </main>
      </PageTransition>

      <Footer />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

export default MainLayout;
