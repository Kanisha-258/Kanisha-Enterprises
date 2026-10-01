import { motion, useReducedMotion } from "framer-motion";
import { Check, CircleDot, CreditCard, Info, X } from "lucide-react";
import { ORDER_STATUS, PAYMENT_STATUS } from "./ui/Badge";

/**
 * An order's progress through its lifecycle.
 *
 * Two sources, and it is honest about which is which:
 *
 * - `statusHistory` — the real record. Every status the order has actually
 *   been in, with the time, who moved it and why. This is what new orders get.
 * - Older orders have no history, because the field did not exist when they were
 *   placed. Rather than invent backdated entries, those fall back to a
 *   progress tracker derived from the current status, and say so. A fabricated
 *   timestamp on a shop's order page is worse than an honest "we don't know".
 *
 * Shared by the customer order page and the admin slide-over so the two cannot
 * disagree about what an order has been through.
 */

const ORDER_FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"];

/**
 * Actor line, so "who did this" reads without a second lookup.
 *
 * `viewer` matters: "by you" is right on the customer's own order page and
 * wrong on the admin's, where the person reading is the shop. Getting this
 * backwards would tell a shopkeeper that they placed the order themselves.
 */
const actorLabel = (event, viewer) => {
  if (event.actorRole === "admin") return "by the shop";
  if (event.actorRole === "customer") return viewer === "admin" ? "by the customer" : "by you";
  return "";
};

const formatWhen = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/** One row: a marker on the line, then the label, when and why. */
function TimelineRow({ icon: Icon, tone, label, when, note, actor, isLast, index, reduceMotion }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* The connecting line. Hidden on the final row so the track ends with
          the marker rather than trailing off into nothing. */}
      {!isLast && (
        <span
          className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-0.5 bg-sand-200"
          aria-hidden="true"
        />
      )}

      <motion.span
        initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: reduceMotion ? 0 : index * 0.07,
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${tone}`}
      >
        <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
      </motion.span>

      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold text-sand-900">
          {label}
          {when && (
            <span className="ml-2 font-normal text-sand-500">{when}</span>
          )}
        </p>

        {actor && <p className="mt-0.5 text-xs text-sand-500">{actor}</p>}

        {note && (
          <p className="mt-1 break-words text-sm leading-relaxed text-sand-600">
            {note}
          </p>
        )}
      </div>
    </li>
  );
}

const MARKER_TONES = {
  done: "bg-brand-600 text-white",
  failed: "bg-red-600 text-white",
  current: "bg-sand-700 text-white",
  upcoming: "bg-sand-100 text-sand-400",
};

/**
 * The real history, when there is one.
 */
function RecordedTimeline({ history, currentStatus, reduceMotion, viewer }) {
  return (
    <ol className="relative">
      {history.map((event, index) => {
        const isCancelled = event.status === "cancelled";
        // The last recorded event is where the order is now. An order that has
        // been cancelled looks "complete" even though it never shipped, so it
        // is treated separately rather than as an unfinished journey.
        const isCurrent =
          index === history.length - 1 && event.status === currentStatus;
        const isLast = index === history.length - 1;

        let tone = MARKER_TONES.done;
        let Icon = Check;

        if (isCancelled) {
          tone = MARKER_TONES.failed;
          Icon = X;
        } else if (isCurrent) {
          tone = MARKER_TONES.current;
          Icon = CircleDot;
        }

        return (
          <TimelineRow
            key={`${event.status}-${event.at ?? index}`}
            index={index}
            isLast={isLast}
            reduceMotion={reduceMotion}
            icon={Icon}
            tone={tone}
            label={ORDER_STATUS[event.status]?.label ?? event.status}
            when={formatWhen(event.at)}
            note={event.note}
            actor={actorLabel(event, viewer)}
          />
        );
      })}
    </ol>
  );
}

/**
 * The fallback for orders placed before status history existed: a progress bar
 * over the forward path, with no invented dates.
 */
function InferredTimeline({ currentStatus, createdAt }) {
  const isCancelled = currentStatus === "cancelled";
  const reached = isCancelled ? 0 : ORDER_FLOW.indexOf(currentStatus);

  if (isCancelled) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
        <p className="text-sm font-semibold text-red-700">
          This order was cancelled
        </p>
        <p className="mt-1 text-sm leading-relaxed text-red-600">
          Placed {formatWhen(createdAt) ?? "earlier"}. Cancelled orders placed
          before we began recording step-by-step progress do not carry a
          cancellation date, so please contact us if you need one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center">
        {ORDER_FLOW.map((step, index) => {
          const done = index <= reached;
          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  done ? "bg-brand-600 text-white" : "bg-sand-100 text-sand-400"
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>
              {index < ORDER_FLOW.length - 1 && (
                <span
                  className={`h-0.5 w-full ${index < reached ? "bg-brand-500" : "bg-sand-200"}`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[11px] font-medium text-sand-500">
        {ORDER_FLOW.map((step) => (
          <span key={step}>{ORDER_STATUS[step].label}</span>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-sand-50 p-3 text-xs leading-relaxed text-sand-600">
        <Info size={14} className="mt-0.5 shrink-0 text-sand-400" aria-hidden="true" />
        <span>
          Showing where this order is now, not when it got there. This order was
          placed before we recorded step-by-step progress, so individual dates
          are not available.
        </span>
      </p>
    </div>
  );
}

/**
 * Payment trail. Separate from the status trail on purpose — an order can be
 * delivered and unpaid, and mixing the two makes both harder to read.
 */
function PaymentTrail({ history }) {
  if (!Array.isArray(history) || history.length === 0) return null;

  return (
    <div className="mt-6 border-t border-sand-200 pt-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand-500">
        <CreditCard size={13} aria-hidden="true" />
        Payment trail
      </p>

      <ol className="space-y-2">
        {history.map((event, index) => {
          const meta = PAYMENT_STATUS[event.paymentStatus];
          const isRefund = event.paymentStatus === "refunded";
          const isFailure = event.paymentStatus === "failed";

          return (
            <li
              key={`${event.paymentStatus}-${event.at ?? index}`}
              className="flex flex-wrap items-baseline gap-x-2 text-xs"
            >
              <span
                className={`font-semibold ${
                  isRefund
                    ? "text-clay-600"
                    : isFailure
                    ? "text-red-600"
                    : "text-sand-700"
                }`}
              >
                {meta?.label ?? event.paymentStatus}
              </span>
              <span className="text-sand-500">
                {formatWhen(event.at)}
                {event.note ? ` — ${event.note}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function OrderTimeline({
  order,
  showPayment = true,
  viewer = "customer",
  className = "",
}) {
  const reduceMotion = useReducedMotion();

  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  const hasHistory = history.length > 0;

  return (
    <div className={className}>
      {hasHistory ? (
        <RecordedTimeline
          history={history}
          currentStatus={order.orderStatus}
          reduceMotion={reduceMotion}
          viewer={viewer}
        />
      ) : (
        <InferredTimeline
          currentStatus={order.orderStatus}
          createdAt={order.createdAt}
        />
      )}

      {showPayment && <PaymentTrail history={order?.paymentHistory} />}
    </div>
  );
}