import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets the scroll position on navigation.
 *
 * Without this, following a link to a new page keeps the old scroll offset
 * and lands the visitor halfway down the new page.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // instant: the page transition handles the visual smoothness, and
    // jumping instantly avoids a long smooth-scroll on every route change.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
