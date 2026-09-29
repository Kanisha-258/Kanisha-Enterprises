import { useEffect, useRef, useState } from "react";

/**
 * Drives a slide-over panel with a plain CSS transition.
 *
 * Why not AnimatePresence? Because the element stayed in the DOM after its
 * exit animation finished, leaving a ~34px strip along one edge that still
 * swallowed clicks. `document.elementFromPoint()` kept returning the closed
 * form. Correctness matters more than the animation here, so this hook takes
 * the two properties that actually matter:
 *
 *   1. `mounted` goes false when the panel is fully closed, so React removes
 *      the nodes outright. Nothing invisible is left behind to intercept
 *      clicks.
 *   2. While the panel is animating out it carries `pointer-events-none`, so
 *      even mid-transition it cannot steal a click from the page behind it.
 *
 * Usage:
 *   const panel = useSlideOver(open);
 *   ...
 *   {panel.mounted && <aside className={panel.shown ? "translate-x-0" : "translate-x-full pointer-events-none"} />}
 *
 * `duration` must match the `duration-*` class on the animated element, or the
 * unmount will happen before the exit finishes.
 */
export default function useSlideOver(open, duration = 300) {
  const [mounted, setMounted] = useState(open);
  // `shown` is what the transition keys off: true = fully open.
  const [shown, setShown] = useState(false);

  const frame = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
    // Clear anything left over from a previous direction change.
    if (frame.current) cancelAnimationFrame(frame.current);
    if (timer.current) clearTimeout(timer.current);

    if (open) {
      setMounted(true);

      // The element has to exist in its off-screen state before the browser
      // can transition it in, otherwise there is no "from" to animate from.
      // Two frames guarantees a paint with the closed classes applied first.
      // The timeout is a backstop in case rAF is throttled.
      frame.current = requestAnimationFrame(() => {
        frame.current = requestAnimationFrame(() => setShown(true));
      });
      timer.current = setTimeout(() => setShown(true), 60);

      return () => {
        cancelAnimationFrame(frame.current);
        clearTimeout(timer.current);
      };
    }

    // Closing: drop `shown` to start the transition, and unmount once it has
    // had time to finish so the nodes are genuinely removed.
    setShown(false);
    timer.current = setTimeout(() => setMounted(false), duration);

    return () => clearTimeout(timer.current);
  }, [open, duration]);

  return { mounted, shown };
}
