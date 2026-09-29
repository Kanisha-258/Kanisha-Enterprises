/** Small status pill. `tone` picks the colour set. */
const TONES = {
  neutral: "bg-sand-100 text-sand-700 ring-sand-200",
  green: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-wheat-50 text-wheat-700 ring-wheat-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  clay: "bg-clay-50 text-clay-700 ring-clay-200",
};

export default function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        TONES[tone] ?? TONES.neutral
      } ${className}`}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

/** Maps an order status to a readable label and colour. */
export const ORDER_STATUS = {
  pending: { label: "Pending", tone: "amber", dot: true },
  confirmed: { label: "Confirmed", tone: "blue", dot: true },
  packed: { label: "Packed", tone: "blue", dot: true },
  shipped: { label: "Shipped", tone: "clay", dot: true },
  delivered: { label: "Delivered", tone: "green", dot: true },
  cancelled: { label: "Cancelled", tone: "red", dot: true },
};

export const PAYMENT_STATUS = {
  pending: { label: "Payment pending", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  failed: { label: "Payment failed", tone: "red" },
  refunded: { label: "Refunded", tone: "clay" },
};

export const ENQUIRY_STATUS = {
  new: { label: "New", tone: "blue", dot: true },
  read: { label: "Read", tone: "neutral" },
  replied: { label: "Replied", tone: "green" },
  archived: { label: "Archived", tone: "neutral" },
};

/** The order lifecycle, used for the progress tracker on the order page. */
export const ORDER_STEPS = ["pending", "confirmed", "packed", "shipped", "delivered"];

export function OrderStatusBadge({ status }) {
  const meta = ORDER_STATUS[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={meta.tone} dot={meta.dot}>{meta.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const meta = PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
