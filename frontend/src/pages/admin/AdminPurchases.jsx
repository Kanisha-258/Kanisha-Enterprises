import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Loader2,
  X,
  Check,
  Trash2,
  Truck,
  PackageCheck,
  Ban,
  CalendarDays,
  IndianRupee,
  ShoppingCart,
  FileText,
} from "lucide-react";

import {
  getPurchases,
  getPurchaseSummary,
  createPurchase,
  updatePurchase,
  receivePurchase,
  cancelPurchase,
  deletePurchase,
  getSuppliers,
} from "../../api/inventoryApi";
import { getAdminProducts } from "../../api/productApi";

// AnimatePresence is deliberately not used for the drawers. Its exit animation
// completed but the node stayed mounted, leaving a strip that swallowed clicks.
// useSlideOver removes the nodes outright instead.
import useSlideOver from "../../hooks/useSlideOver";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

const STATUS_STYLES = {
  draft: "bg-sand-100 text-sand-600",
  received: "bg-brand-50 text-brand-700",
  cancelled: "bg-red-50 text-red-700",
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function AdminPurchases() {
  const toast = useToast();

  const [purchases, setPurchases] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [stats, setStats] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const drawerPanel = useSlideOver(drawerOpen);

  // A blank line, ready to fill in. productId/costPrice/quantity are the parts
  // the admin actually types; name and unit are looked up for display.
  const blankLine = () => ({ productId: "", costPrice: "", quantity: "1", name: "", unit: "" });

  const [form, setForm] = useState({
    supplier: "",
    purchaseDate: "",
    notes: "",
    discount: "",
    items: [blankLine()],
  });

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const cancelPanel = useSlideOver(Boolean(cancelTarget));

  const load = async () => {
    try {
      setLoading(true);

      const data = await getPurchases({
        page,
        limit: 20,
        search: search || undefined,
        status,
      });

      setPurchases(data.purchases || []);
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
  }, [page, search, status]);

  useEffect(() => {
    getSuppliers({ isActive: "true", limit: 100 })
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {});

    getAdminProducts({ limit: 200 })
      .then((d) => setProducts(d.products || []))
      .catch(() => {});

    getPurchaseSummary()
      .then(setStats)
      .catch(() => {});
  }, []);

  /* --------------------------- Calculations --------------------------- */

  // Mirrors the server's arithmetic so the admin sees a running total while
  // typing, without the server having to be asked on every keystroke.
  const subtotal = useMemo(
    () =>
      form.items.reduce((sum, line) => {
        const cost = Number(line.costPrice);
        const qty = Number(line.quantity);
        if (!Number.isFinite(cost) || !Number.isFinite(qty)) return sum;
        return sum + cost * qty;
      }, 0),
    [form.items]
  );

  const discount = Math.min(Math.max(0, Number(form.discount) || 0), subtotal);
  const total = subtotal - discount;

  /* ------------------------------ Actions ----------------------------- */

  const setLine = (index, key) => (e) => {
    const value = e.target.value;
    setForm((p) => ({
      ...p,
      items: p.items.map((line, i) => {
        if (i !== index) return line;
        if (key !== "productId") return { ...line, [key]: value };

        // Look up name/unit for display so the admin can see what they picked.
        const found = products.find((x) => x._id === value);
        return { ...line, productId: value, name: found?.name || "", unit: found?.unit || "" };
      }),
    }));
  };

  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, blankLine()] }));

  const removeLine = (index) =>
    setForm((p) => ({
      ...p,
      items: p.items.length === 1 ? p.items : p.items.filter((_, i) => i !== index),
    }));

  const openCreate = () => {
    setEditing(null);
    setForm({
      supplier: "",
      purchaseDate: new Date().toISOString().slice(0, 10),
      notes: "",
      discount: "",
      items: [blankLine()],
    });
    setDrawerOpen(true);
  };

  const openEdit = (purchase) => {
    setEditing(purchase._id);
    setForm({
      supplier: String(purchase.supplier?._id || purchase.supplier),
      purchaseDate: purchase.purchaseDate
        ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
        : "",
      notes: purchase.notes || "",
      discount: String(purchase.discount || 0),
      items: purchase.items.map((i) => ({
        productId: String(i.product?._id || i.product),
        costPrice: String(i.costPrice),
        quantity: String(i.quantity),
        name: i.name,
        unit: i.unit,
      })),
    });
    setDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.supplier) {
      toast.error("Choose a supplier.");
      return;
    }

    const valid = form.items.every((line) => {
      const cost = Number(line.costPrice);
      const qty = Number(line.quantity);
      return line.productId && Number.isFinite(cost) && cost >= 0 && Number.isInteger(qty) && qty > 0;
    });

    if (!valid) {
      toast.error("Every line needs a product, a cost price and a whole quantity of at least 1.");
      return;
    }

    setSaving(true);

    const payload = {
      supplier: form.supplier,
      purchaseDate: form.purchaseDate || undefined,
      notes: form.notes,
      discount: Number(form.discount) || 0,
      items: form.items.map((line) => ({
        productId: line.productId,
        costPrice: Number(line.costPrice),
        quantity: Number(line.quantity),
      })),
    };

    try {
      if (editing) {
        await updatePurchase(editing, payload);
        toast.success("Purchase updated");
      } else {
        await createPurchase(payload);
        toast.success("Purchase saved as a draft");
      }

      setDrawerOpen(false);
      setEditing(null);
      load();
      getPurchaseSummary().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (purchase) => {
    if (
      !window.confirm(
        `Add ${purchase.items.reduce((s, i) => s + i.quantity, 0)} unit(s) to stock?\n\nThis can only be done once for this purchase.`
      )
    ) {
      return;
    }

    setBusyId(purchase._id);

    try {
      const result = await receivePurchase(purchase._id);
      toast.success(result.message || "Stock added");
      load();
      getPurchaseSummary().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async () => {
    setBusyId(cancelTarget._id);

    try {
      const result = await cancelPurchase(cancelTarget._id, cancelReason);
      toast.success(result.message || "Purchase cancelled");
      setCancelTarget(null);
      setCancelReason("");
      load();
      getPurchaseSummary().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (purchase) => {
    if (!window.confirm(`Delete draft ${purchase.purchaseNumber}?`)) return;

    setBusyId(purchase._id);

    try {
      await deletePurchase(purchase._id);
      toast.success("Draft deleted");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const shortDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  /* ------------------------------ Render ------------------------------ */

  const noSuppliers = suppliers.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Purchases</h1>
          <p className="mt-1 text-sm text-sand-500">
            Record what you bought. Stock is only added when you receive it.
          </p>
        </div>

        <button
          onClick={openCreate}
          disabled={noSuppliers}
          title={noSuppliers ? "Add a supplier first" : undefined}
          className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={17} />
          New purchase
        </button>
      </div>

      {noSuppliers && (
        <div className="card flex items-start gap-3 border-l-4 border-l-wheat-400 p-4">
          <Truck size={18} className="mt-0.5 shrink-0 text-wheat-600" />
          <p className="text-sm text-sand-600">
            You need a supplier before you can record a purchase.{" "}
            <a href="/admin/suppliers" className="font-semibold text-brand-700 hover:underline">
              Add a supplier
            </a>
            .
          </p>
        </div>
      )}

      {/* Summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total spend", value: rupees(stats.totalSpend), icon: IndianRupee },
            { label: "This month", value: rupees(stats.monthSpend), icon: CalendarDays },
            { label: "Purchases", value: stats.totalPurchases, icon: ShoppingCart },
            { label: "Active suppliers", value: stats.activeSuppliers, icon: Truck },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center gap-2 text-brand-600">
                <Icon size={16} />
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
            placeholder="Search by purchase number, product or note…"
            aria-label="Search purchases"
            className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={search || status !== "all" ? "No matching purchases" : "No purchases yet"}
          message={
            search || status !== "all"
              ? "Try a different search or status."
              : "Record a purchase when you buy stock. Draft it first, then receive the goods to add them to your inventory."
          }
          action={
            !search &&
            status === "all" &&
            !noSuppliers && { label: "Record a purchase", onClick: openCreate }
          }
        />
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase, i) => {
            const isDraft = purchase.status === "draft";
            const isReceived = purchase.status === "received";
            const units = purchase.items.reduce((s, item) => s + item.quantity, 0);

            return (
              <motion.div
                key={purchase._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.25) }}
                className="card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-sand-900">
                        {purchase.purchaseNumber}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          STATUS_STYLES[purchase.status]
                        }`}
                      >
                        {purchase.status}
                      </span>
                      {isReceived && (
                        <span className="text-[11px] text-sand-400">
                          received {shortDate(purchase.receivedAt)}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-sand-600">
                      <Truck size={13} className="shrink-0 text-sand-400" />
                      {purchase.supplier?.name || "Unknown supplier"}
                      {purchase.supplier?.companyName && (
                        <span className="text-sand-400">
                          · {purchase.supplier.companyName}
                        </span>
                      )}
                    </p>

                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-sand-400">
                      <CalendarDays size={12} />
                      {shortDate(purchase.purchaseDate)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl font-bold text-sand-900">
                      {rupees(purchase.total)}
                    </p>
                    {purchase.discount > 0 && (
                      <p className="text-xs text-brand-600">
                        {rupees(purchase.subtotal)} − {rupees(purchase.discount)}
                      </p>
                    )}
                    <p className="text-xs text-sand-400">{units} units</p>
                  </div>
                </div>

                {/* Lines */}
                <ul className="mt-4 space-y-1.5 border-t border-sand-100 pt-4">
                  {purchase.items.map((item) => (
                    <li
                      key={item._id}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="text-sand-700">
                        {item.name}
                        {item.unit && <span className="text-sand-400"> ({item.unit})</span>}
                      </span>
                      <span className="text-sand-500">
                        {item.quantity} × {rupees(item.costPrice)} ={" "}
                        <span className="font-semibold text-sand-800">
                          {rupees(item.lineTotal)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                {purchase.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-sand-50 px-3.5 py-2.5 text-sm text-sand-600">
                    {purchase.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {isDraft && (
                    <>
                      <button
                        onClick={() => handleReceive(purchase)}
                        disabled={busyId === purchase._id}
                        className="btn-shine flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
                      >
                        {busyId === purchase._id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <PackageCheck size={15} />
                        )}
                        Receive goods — add to stock
                      </button>

                      <button
                        onClick={() => openEdit(purchase)}
                        className="rounded-xl border border-sand-200 px-4 py-2.5 text-sm font-semibold text-sand-600 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(purchase)}
                        disabled={busyId === purchase._id}
                        className="rounded-xl border border-sand-200 p-2.5 text-sand-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Delete ${purchase.purchaseNumber}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}

                  {isReceived && (
                    <>
                      <button
                        onClick={() => {
                          setCancelTarget(purchase);
                          setCancelReason("");
                        }}
                        disabled={busyId === purchase._id}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Ban size={15} />
                        Cancel and return stock
                      </button>
                      <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700">
                        <Check size={15} />
                        Stock received
                      </span>
                    </>
                  )}

                  {purchase.status === "cancelled" && (
                    <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sand-100 px-4 py-2.5 text-sm font-semibold text-sand-500">
                      <Ban size={15} />
                      Cancelled {shortDate(purchase.cancelledAt)}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      {/* Create / edit drawer. A plain CSS transition rather than
          AnimatePresence: the exit animation completed but the node stayed
          mounted, leaving a strip that swallowed clicks. See useSlideOver. */}
      {drawerPanel.mounted && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            className={`fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm transition-opacity duration-300 ${
              drawerPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit purchase" : "New purchase"}
            className={`fixed inset-y-0 right-0 z-[96] flex w-full max-w-2xl flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out ${
              drawerPanel.shown ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-sand-900">
                    {editing ? "Edit purchase" : "New purchase"}
                  </h2>
                  {!editing && (
                    <p className="text-xs text-sand-500">
                      Saved as a draft. Stock is added when you receive it.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* The footer buttons sit outside this element for layout, so the
                  form needs an id and its submit button a `form` attribute.
                  Without that association the button does nothing. */}
              <form
                id="purchase-form"
                onSubmit={handleSave}
                className="flex-1 space-y-5 overflow-y-auto p-6"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">Supplier *</label>
                    <select
                      required
                      value={form.supplier}
                      onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
                      className={`mt-1.5 ${field}`}
                    >
                      <option value="">Choose a supplier…</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                          {s.companyName ? ` — ${s.companyName}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">Purchase date</label>
                    <input
                      type="date"
                      value={form.purchaseDate}
                      onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
                      className={`mt-1.5 ${field}`}
                    />
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-sand-700">Items *</label>
                    <button
                      type="button"
                      onClick={addLine}
                      className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
                    >
                      <Plus size={14} />
                      Add line
                    </button>
                  </div>

                  <div className="mt-2.5 space-y-2.5">
                    {form.items.map((line, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-sand-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-sand-400">
                            Line {index + 1}
                          </span>

                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="rounded-lg p-1.5 text-sand-400 transition hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove line ${index + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="mt-2 space-y-2">
                          <select
                            required
                            value={line.productId}
                            onChange={setLine(index, "productId")}
                            aria-label={`Product for line ${index + 1}`}
                            className={field}
                          >
                            <option value="">Choose a product…</option>
                            {products.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name}
                                {p.unit ? ` (${p.unit})` : ""} — stock {p.stock}
                              </option>
                            ))}
                          </select>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.costPrice}
                                onChange={setLine(index, "costPrice")}
                                placeholder="Cost price ₹"
                                aria-label={`Cost price for line ${index + 1}`}
                                className={field}
                              />
                            </div>

                            <div>
                              <input
                                required
                                type="number"
                                min="1"
                                step="1"
                                value={line.quantity}
                                onChange={setLine(index, "quantity")}
                                placeholder="Quantity"
                                aria-label={`Quantity for line ${index + 1}`}
                                className={field}
                              />
                            </div>
                          </div>

                          <p className="text-right text-xs text-sand-500">
                            Line total{" "}
                            <span className="font-semibold text-sand-800">
                              {rupees(
                                (Number(line.costPrice) || 0) * (Number(line.quantity) || 0)
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Discount (₹ off the whole purchase)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.discount}
                      onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                      placeholder="0"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="w-full rounded-2xl bg-white p-3.5 text-sm">
                      <div className="flex justify-between text-sand-600">
                        <span>Subtotal</span>
                        <span>{rupees(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-brand-600">
                          <span>Discount</span>
                          <span>−{rupees(discount)}</span>
                        </div>
                      )}
                      <div className="mt-1.5 flex justify-between border-t border-sand-100 pt-1.5 font-display text-lg font-bold text-sand-900">
                        <span>Total</span>
                        <span>{rupees(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Invoice number, payment terms, delivery condition…"
                    className={`mt-1.5 ${field} resize-none`}
                  />
                </div>
              </form>

              <div className="flex gap-3 border-t border-sand-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-xl border border-sand-200 px-5 py-3 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="purchase-form"
                  disabled={saving}
                  className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  {editing ? "Save changes" : "Save draft"}
                </button>
              </div>
          </div>
        </>
      )}

      {/* Cancel confirmation, same approach. */}
      {cancelPanel.mounted && cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancel purchase"
          className={`fixed left-1/2 top-1/2 z-[96] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-2xl transition-opacity duration-300 ${
            cancelPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div
            onClick={() => setCancelTarget(null)}
            className="fixed inset-0 z-[-1] bg-sand-950/50 backdrop-blur-sm"
            aria-hidden="true"
          />
              <h2 className="font-display text-lg font-bold text-sand-900">
                Cancel {cancelTarget.purchaseNumber}?
              </h2>

              <p className="mt-2 text-sm text-sand-600">
                This will return{" "}
                <strong className="text-sand-900">
                  {cancelTarget.items.reduce((s, i) => s + i.quantity, 0)} unit(s)
                </strong>{" "}
                of stock that were added when this purchase was received. The purchase
                record and its stock history are kept.
              </p>

              <div className="mt-5">
                <label className="text-sm font-semibold text-sand-700">
                  Reason (shown in the stock history)
                </label>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Wrong grade, damaged goods…"
                  className={`mt-1.5 ${field}`}
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 rounded-xl border border-sand-200 px-5 py-3 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                >
                  Keep it
                </button>

                <button
                  onClick={handleCancel}
                  disabled={busyId === cancelTarget._id}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {busyId === cancelTarget._id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Ban size={16} />
                  )}
                  Cancel purchase
                </button>
              </div>
        </div>
      )}
    </div>
  );
}
