import { useEffect, useState } from "react";
// AnimatePresence is deliberately not used for the dialogs. Its exit animation
// completed but the node stayed mounted, leaving a strip that swallowed clicks.
// useSlideOver removes the nodes outright instead.
import useSlideOver from "../../hooks/useSlideOver";
import {
  Search,
  Loader2,
  X,
  SlidersHorizontal,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  Hand,
  ShoppingBag,
  Undo2,
  AlertTriangle,
  Boxes,
  History,
  TrendingUp,
  TrendingDown,
  ScrollText,
} from "lucide-react";

import {
  getInventory,
  getInventorySummary,
  getProductHistory,
  getMovements,
  adjustStock,
} from "../../api/inventoryApi";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// How each movement type reads, and which way it moved stock.
const MOVEMENT_META = {
  STOCK_IN: { label: "Stock in", icon: ArrowDownCircle, tone: "bg-brand-50 text-brand-700" },
  SALE: { label: "Sold", icon: ShoppingBag, tone: "bg-sand-100 text-sand-600" },
  SALE_CANCEL: { label: "Order cancelled", icon: Undo2, tone: "bg-wheat-50 text-wheat-700" },
  MANUAL_ADJUSTMENT: { label: "Manual", icon: Hand, tone: "bg-sand-100 text-sand-700" },
};

const StockPill = ({ stock }) => {
  if (stock === 0) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
        Out of stock
      </span>
    );
  }

  if (stock <= 10) {
    return (
      <span className="rounded-full bg-wheat-50 px-2.5 py-0.5 text-[11px] font-bold text-wheat-700">
        Low
      </span>
    );
  }

  return null;
};

export default function AdminInventory() {
  const toast = useToast();

  const [inventory, setInventory] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState(null);

  // Adjustment dialog
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustDirection, setAdjustDirection] = useState("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const adjustPanel = useSlideOver(Boolean(adjustTarget));

  // History drawer
  const [historyTarget, setHistoryTarget] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyPanel = useSlideOver(Boolean(historyTarget));

  // Global movement feed
  const [feed, setFeed] = useState([]);
  const [feedType, setFeedType] = useState("all");
  const [feedLoading, setFeedLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);

      const data = await getInventory({
        page,
        limit: 20,
        search: search || undefined,
        stock: stockFilter,
      });

      setInventory(data.inventory || []);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, stockFilter]);

  useEffect(() => {
    getInventorySummary().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    setFeedLoading(true);
    getMovements({ type: feedType, limit: 25 })
      .then((d) => {
        if (!cancelled) setFeed(d.movements || []);
      })
      .catch(() => {
        if (!cancelled) setFeed([]);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feedType]);

  /* ----------------------------- Actions ----------------------------- */

  const openAdjust = (row, direction = "add") => {
    setAdjustTarget(row);
    setAdjustDirection(direction);
    setAdjustQty("");
    setAdjustReason("");
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();

    const quantity = Number(adjustQty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Enter a whole quantity of at least 1.");
      return;
    }

    if (adjustReason.trim().length < 5) {
      toast.error("Please give a reason of at least 5 characters.");
      return;
    }

    setAdjusting(true);

    try {
      const result = await adjustStock(adjustTarget._id, {
        direction: adjustDirection,
        quantity,
        reason: adjustReason.trim(),
      });

      toast.success(
        `${result.product.name} is now ${result.product.stock} in stock`
      );

      setAdjustTarget(null);
      load();
      getInventorySummary().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const openHistory = async (row) => {
    setHistoryTarget(row);
    setHistory(null);
    setHistoryLoading(true);

    try {
      setHistory(await getProductHistory(row._id, { limit: 60 }));
    } catch (err) {
      toast.error(err.message);
      setHistoryTarget(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  // The clock is read in an effect, not during render, and the result held in
  // state. Reading Date.now() in the render body is impure — it can return a
  // different value on each render, so the "3 days ago" labels would flicker
  // and the rule is there to stop that class of bug.
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, [feed, inventory, history]);

  const formatWhen = (d) => {
    if (!d || !now) return "—";

    const date = new Date(d);
    const days = Math.floor((now - date.getTime()) / 86400000);

    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;

    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatTime = (d) =>
    d
      ? new Date(d).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900">Inventory</h1>
        <p className="mt-1 text-sm text-sand-500">
          Stock levels and every movement that changed them
        </p>
      </div>

      {/* Summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            {
              label: "Units in stock",
              value: stats.totalUnits,
              icon: Boxes,
              tone: "text-sand-600",
            },
            {
              label: "Low stock",
              value: stats.lowStock,
              icon: AlertTriangle,
              tone: "text-wheat-600",
            },
            {
              label: "Out of stock",
              value: stats.outOfStock,
              icon: AlertTriangle,
              tone: "text-red-600",
            },
            {
              label: "Received (30d)",
              value: `+${stats.stockIn30d}`,
              icon: TrendingUp,
              tone: "text-brand-600",
            },
            {
              label: "Sold (30d)",
              value: `−${stats.sold30d}`,
              icon: TrendingDown,
              tone: "text-sand-600",
            },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="card p-4">
              <div className={`flex items-center gap-2 ${tone}`}>
                <Icon size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
              </div>
              <p className="mt-1.5 font-display text-xl font-bold text-sand-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by product name, SKU or category…"
            aria-label="Search inventory"
            className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <select
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by stock level"
          className="rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="all">All stock levels</option>
          <option value="low">Low stock only</option>
          <option value="out">Out of stock only</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : inventory.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || stockFilter !== "all" ? "No matching products" : "No products yet"}
          message={
            search || stockFilter !== "all"
              ? "Try a different search or stock filter."
              : "Products you add will appear here with their stock levels."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-sand-200 bg-sand-50 text-left">
                <tr className="text-[11px] uppercase tracking-wider text-sand-500">
                  <th className="px-5 py-3 font-bold">Product</th>
                  <th className="px-4 py-3 font-bold">Stock</th>
                  <th className="px-4 py-3 font-bold">Avg cost</th>
                  <th className="px-4 py-3 font-bold">Margin</th>
                  <th className="px-4 py-3 font-bold">Last movement</th>
                  <th className="px-5 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-sand-100">
                {inventory.map((row) => (
                  <tr key={row._id} className="transition hover:bg-sand-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-sand-900">{row.name}</p>
                      <p className="text-xs text-sand-400">
                        {row.sku} · {row.category}
                        {row.unit ? ` · ${row.unit}` : ""}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-display text-lg font-bold ${
                            row.stock === 0
                              ? "text-red-600"
                              : row.lowStock
                                ? "text-wheat-700"
                                : "text-sand-900"
                          }`}
                        >
                          {row.stock}
                        </span>
                        <StockPill stock={row.stock} />
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-sand-600">
                      {row.averageCost === null ? (
                        <span className="text-xs text-sand-400">never bought</span>
                      ) : (
                        rupees(row.averageCost)
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {row.marginPercent === null ? (
                        <span className="text-xs text-sand-400">—</span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            row.marginPercent >= 0 ? "text-brand-600" : "text-red-600"
                          }`}
                        >
                          {row.marginPercent}%
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-sand-500">
                      {row.lastMovement ? (
                        <span className="text-xs">
                          {MOVEMENT_META[row.lastMovement.type]?.label ?? row.lastMovement.type}{" "}
                          {row.lastMovement.direction === 1 ? "+" : "−"}
                          {row.lastMovement.quantity}
                          <span className="block text-sand-400">
                            {formatWhen(row.lastMovement.at)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-sand-400">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openHistory(row)}
                          className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                          aria-label={`Stock history for ${row.name}`}
                        >
                          <History size={16} />
                        </button>

                        <button
                          onClick={() => openAdjust(row, "add")}
                          className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                          aria-label={`Add stock to ${row.name}`}
                        >
                          <SlidersHorizontal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {inventory.map((row) => (
              <div key={row._id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sand-900">{row.name}</p>
                    <p className="text-xs text-sand-400">
                      {row.sku} · {row.category}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`font-display text-xl font-bold ${
                        row.stock === 0 ? "text-red-600" : row.lowStock ? "text-wheat-700" : "text-sand-900"
                      }`}
                    >
                      {row.stock}
                    </p>
                    <StockPill stock={row.stock} />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3">
                  <span className="text-xs text-sand-500">
                    Avg cost{" "}
                    {row.averageCost === null ? "—" : rupees(row.averageCost)}
                  </span>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openHistory(row)}
                      className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                      aria-label={`Stock history for ${row.name}`}
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => openAdjust(row, "add")}
                      className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                      aria-label={`Adjust stock for ${row.name}`}
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      {/* Recent movement feed */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-sand-900">
            <ScrollText size={18} className="text-brand-600" />
            Recent stock movements
          </h2>

          <select
            value={feedType}
            onChange={(e) => setFeedType(e.target.value)}
            aria-label="Filter movements by type"
            className="rounded-xl border border-sand-200 bg-white px-4 py-2 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">All movements</option>
            <option value="STOCK_IN">Stock in</option>
            <option value="SALE">Sales</option>
            <option value="SALE_CANCEL">Cancellations</option>
            <option value="MANUAL_ADJUSTMENT">Manual</option>
          </select>
        </div>

        {feedLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-brand-500" />
          </div>
        ) : feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand-400">
            No movements recorded yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-sand-100">
            {feed.map((m) => {
              const meta = MOVEMENT_META[m.type] ?? {
                label: m.type,
                icon: History,
                tone: "bg-sand-100 text-sand-600",
              };
              const Icon = meta.icon;

              return (
                <li key={m._id} className="flex items-start gap-3 py-3">
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${meta.tone}`}
                  >
                    <Icon size={15} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-sand-800">
                      <span className="font-semibold">{m.productName || "Product"}</span>{" "}
                      <span
                        className={`font-bold ${
                          m.direction === 1 ? "text-brand-600" : "text-sand-600"
                        }`}
                      >
                        {m.direction === 1 ? "+" : "−"}
                        {m.quantity}
                      </span>
                    </p>

                    <p className="mt-0.5 truncate text-xs text-sand-500">
                      {m.reason || meta.label} · {m.previousStock} → {m.newStock}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <p className="mt-1 text-[11px] text-sand-400">{formatTime(m.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Adjustment dialog. A plain CSS transition rather than AnimatePresence:
          the exit animation completed but the node stayed mounted, leaving a
          strip that swallowed clicks. See useSlideOver. */}
      {adjustPanel.mounted && adjustTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Adjust stock"
          className={`fixed left-1/2 top-1/2 z-[96] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-2xl transition-opacity duration-300 ${
            adjustPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div
            onClick={() => setAdjustTarget(null)}
            className="fixed inset-0 z-[-1] bg-sand-950/50 backdrop-blur-sm"
            aria-hidden="true"
          />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-sand-900">
                  Adjust stock
                </h2>
                <p className="mt-0.5 truncate text-sm text-sand-500">{adjustTarget.name}</p>
              </div>

              <button
                onClick={() => setAdjustTarget(null)}
                className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

              <p className="mt-3 rounded-xl bg-sand-50 px-4 py-3 text-sm text-sand-600">
                Current stock:{" "}
                <strong className="text-sand-900">{adjustTarget.stock}</strong>
                {adjustTarget.unit ? ` ${adjustTarget.unit}` : ""}
              </p>

              <form onSubmit={submitAdjustment} className="mt-5 space-y-4">
                {/* Direction */}
                <div>
                  <label className="text-sm font-semibold text-sand-700">What happened?</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { value: "add", label: "Add stock", icon: ArrowDownCircle },
                      { value: "remove", label: "Remove stock", icon: ArrowUpCircle },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAdjustDirection(value)}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                          adjustDirection === value
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-sand-200 text-sand-600 hover:border-sand-300"
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">Quantity *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="How many?"
                    className={`mt-1.5 ${field}`}
                  />
                  <p className="mt-1 text-xs text-sand-400">
                    New stock will be{" "}
                    <strong className="text-sand-600">
                      {Math.max(
                        0,
                        adjustTarget.stock +
                          (adjustDirection === "add" ? 1 : -1) * (Number(adjustQty) || 0)
                      )}
                    </strong>
                    . Stock can never go below zero.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">Reason *</label>
                  <input
                    required
                    minLength={5}
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Two bags damaged in storage"
                    className={`mt-1.5 ${field}`}
                  />
                  <p className="mt-1 text-xs text-sand-400">
                    Recorded permanently in the stock history. This is the only record of
                    why the number changed.
                  </p>
                </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="flex-1 rounded-xl border border-sand-200 px-5 py-3 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={adjusting}
                  className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {adjusting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <SlidersHorizontal size={16} />
                  )}
                  Record change
                </button>
              </div>
            </form>
        </div>
      )}

      {/* History drawer, same approach. */}
      {historyPanel.mounted && historyTarget && (
        <>
          <div
            onClick={() => setHistoryTarget(null)}
            className={`fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm transition-opacity duration-300 ${
              historyPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Stock history for ${historyTarget.name}`}
            className={`fixed inset-y-0 right-0 z-[96] flex w-full max-w-xl flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out ${
              historyPanel.shown ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
              <div className="flex items-start justify-between border-b border-sand-200 bg-white px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold text-sand-900">
                    {historyTarget.name}
                  </h2>
                  <p className="text-sm text-sand-500">
                    {history?.product
                      ? `${history.product.stock} in stock now`
                      : "Loading…"}
                  </p>
                </div>

                <button
                  onClick={() => setHistoryTarget(null)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-brand-500" />
                  </div>
                ) : !history ? (
                  <p className="py-10 text-center text-sm text-sand-400">
                    Could not load the history.
                  </p>
                ) : (
                  <>
                    {/* Totals */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="card p-4 text-center">
                        <ArrowDownCircle size={16} className="mx-auto text-brand-600" />
                        <p className="mt-1.5 font-display text-xl font-bold text-sand-900">
                          {history.totalUnitsIn}
                        </p>
                        <p className="text-[11px] text-sand-500">Total units in</p>
                      </div>

                      <div className="card p-4 text-center">
                        <ArrowUpCircle size={16} className="mx-auto text-sand-600" />
                        <p className="mt-1.5 font-display text-xl font-bold text-sand-900">
                          {history.totalUnitsOut}
                        </p>
                        <p className="text-[11px] text-sand-500">Total units out</p>
                      </div>
                    </div>

                    {/* Stock in */}
                    <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-sand-400">
                      Stock in ({history.stockIn.length})
                    </h3>

                    {history.stockIn.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-white px-4 py-5 text-center text-sm text-sand-400">
                        Nothing has come in yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {history.stockIn.map((m) => (
                          <HistoryRow key={m._id} movement={m} formatTime={formatTime} rupees={rupees} />
                        ))}
                      </ul>
                    )}

                    {/* Stock out */}
                    <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-sand-400">
                      Stock out ({history.stockOut.length})
                    </h3>

                    {history.stockOut.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-white px-4 py-5 text-center text-sm text-sand-400">
                        Nothing has gone out yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {history.stockOut.map((m) => (
                          <HistoryRow key={m._id} movement={m} formatTime={formatTime} rupees={rupees} />
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One row in the stock-in / stock-out history lists. */
function HistoryRow({ movement, formatTime, rupees }) {
  const meta = MOVEMENT_META[movement.type] ?? {
    label: movement.type,
    icon: History,
    tone: "bg-sand-100 text-sand-600",
  };
  const Icon = meta.icon;

  return (
    <li className="card flex items-start gap-3 p-3.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span
            className={`font-bold ${
              movement.direction === 1 ? "text-brand-600" : "text-sand-600"
            }`}
          >
            {movement.direction === 1 ? "+" : "−"}
            {movement.quantity}
          </span>{" "}
          <span className="text-sand-400">
            ({movement.previousStock} → {movement.newStock})
          </span>
        </p>

        <p className="mt-0.5 text-xs text-sand-500">
          {movement.referenceType === "purchase" && movement.supplier
            ? `From ${movement.supplier.name}`
            : movement.referenceType === "order"
              ? "Customer order"
              : movement.reason || "Manual change"}
        </p>

        {movement.referenceType === "purchase" && movement.unitCost !== null && (
          <p className="mt-0.5 text-xs text-sand-400">
            at {rupees(movement.unitCost)} per unit
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
          {meta.label}
        </span>
        <p className="mt-1 text-[11px] text-sand-400">{formatTime(movement.createdAt)}</p>
      </div>
    </li>
  );
}
