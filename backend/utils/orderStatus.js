/**
 * The order lifecycle, in one place.
 *
 * ## Why this file exists
 *
 * Order status used to be validated as "any of the six known values", which
 * is not the same thing as "a legal move". An admin could take a delivered
 * order back to pending, or ship a cancelled one, and nothing stopped it.
 *
 * Both the API and the admin UI need to agree on what is legal, and if they
 * each keep their own copy they will drift. So the rules live here and
 * everything else asks.
 *
 * ## On "packed" vs "processing"
 *
 * The stage some shops call "processing" is named `packed` in this project.
 * It has shipped in production data, is asserted on by the Phase 2 and Phase 3
 * suites, and is what the storefront and admin UI already display. Renaming it
 * would be a breaking data change for no functional gain, so it stays as
 * `packed` and is treated as the processing/preparation stage.
 *
 * ## The shape of the rules
 *
 * 1. `delivered` and `cancelled` are terminal. Nothing leaves them. That covers
 *    "delivered must not go back to processing" and "cancelled must not be
 *    processed again".
 * 2. A move to `cancelled` is only legal while the goods have not left the
 *    shop — pending, confirmed or packed. Once shipped they are with the
 *    customer, and a return is a different workflow, not a cancellation.
 * 3. Within the forward flow an order may also move *backwards*, because a
 *    mis-click is a real thing and there is no other way to correct it. The
 *    terminal states above still cannot be escaped.
 */

/** Every status the model allows, in lifecycle order. */
const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

/** The forward path, in order. Drives the customer-facing timeline. */
const ORDER_FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"];

/** Statuses from which an order may still be cancelled. */
const CANCELLABLE_STATUSES = ["pending", "confirmed", "packed"];

/** Statuses an order can never leave. */
const TERMINAL_STATUSES = ["delivered", "cancelled"];

/** Payment states, mirroring the Order model enum. */
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const isOrderStatus = (value) => ORDER_STATUSES.includes(value);

/** No way out of these. */
const isTerminal = (value) => TERMINAL_STATUSES.includes(value);

const isCancellable = (value) => CANCELLABLE_STATUSES.includes(value);

/**
 * Whether moving an order from `from` to `to` is allowed.
 *
 * Returns a plain boolean; `describeTransition` gives the message.
 */
const canTransition = (from, to) => {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;

  // Already there. Treated as illegal so the caller reports it rather than
  // silently re-running a status change that may move stock.
  if (from === to) return false;

  // A delivered or cancelled order is finished.
  if (isTerminal(from)) return false;

  // Goods already with the customer: a return is not a cancellation.
  if (to === "cancelled") return isCancellable(from);

  return ORDER_FLOW.includes(to);
};

/**
 * The statuses an admin may move this order to right now.
 *
 * Used to build the admin dropdown, so the UI cannot offer a move the API
 * would then reject.
 */
const nextStatuses = (from) => ORDER_STATUSES.filter((to) => canTransition(from, to));

/**
 * A message explaining why a move is not allowed, written for an admin.
 *
 * Returns null when the move is fine, so the caller can use it as both the
 * test and the error text.
 */
const describeTransition = (from, to) => {
  if (!isOrderStatus(to)) {
    return `"${to}" is not a valid order status.`;
  }

  if (from === to) {
    return `This order is already ${from}.`;
  }

  if (from === "delivered") {
    return "A delivered order cannot be changed — it is complete. Raise a return or refund instead.";
  }

  if (from === "cancelled") {
    return "This order was cancelled and cannot be reopened or progressed.";
  }

  if (to === "cancelled") {
    return isCancellable(from)
      ? null
      : `An order that is already ${from} can no longer be cancelled. Once it has shipped it is with the customer.`;
  }

  return null;
};

module.exports = {
  ORDER_STATUSES,
  ORDER_FLOW,
  CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  PAYMENT_STATUSES,
  isOrderStatus,
  isTerminal,
  isCancellable,
  canTransition,
  nextStatuses,
  describeTransition,
};
