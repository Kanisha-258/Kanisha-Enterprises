import { useEffect, useRef } from "react";

import useAuthStore from "../store/authStore";
import useCartStore from "../store/cartStore";

/**
 * Keeps the browser's cart in step with whoever is signed in.
 *
 * The cart is stored per user, so a change of account has to move the browser
 * onto a different storage slot. This watches the session and does exactly
 * that, in the two cases that matter:
 *
 *   signing in   fold the guest basket into the saved one, then adopt it
 *   signing out  step off the account's slot, so the next person on a shared
 *                browser doesn't inherit it
 *
 * It lives in a component rather than inside either store because the cart
 * store already depends on the auth store; reacting from here keeps that
 * dependency one-way and guarantees both stores are fully built before any of
 * this runs.
 *
 * Mounted once, in App.
 */
export default function useCartSync() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?._id);

  // The previous identity, so the first render is not mistaken for a sign-in.
  const previous = useRef({ token: null, userId: null });

  useEffect(() => {
    const before = previous.current;
    const signedIn = Boolean(token);
    const wasSignedIn = Boolean(before.token);
    const sameAccount = before.userId === userId;

    previous.current = { token, userId };

    // Editing a profile changes the user object but not who it is, and a
    // re-merge would be pointless work.
    if (signedIn && wasSignedIn && sameAccount) return;

    if (signedIn) {
      // Either a fresh sign-in or a reload with a session already in place.
      // Both need the saved cart, and both may have a guest basket waiting, so
      // syncOnLogin covers them — it merges whatever the guest had and then
      // adopts the server's answer.
      useCartStore.getState().syncOnLogin();
      return;
    }

    // Signing out. Step off this account's slot so the next person on a shared
    // browser doesn't inherit their basket. A first load while already signed
    // out needs nothing: the store read the guest slot at module init.
    if (wasSignedIn) {
      useCartStore.getState().switchUser();
    }
  }, [token, userId]);
}
