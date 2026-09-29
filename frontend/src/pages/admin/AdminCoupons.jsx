import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Loader2,
  X,
  Check,
  Pencil,
  Trash2,
  Clock,
  Ban,
  Search,
  Ticket,
  Layers,
} from "lucide-react";

import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "../../api/couponApi";
import { getCategories } from "../../api/productApi";
import EmptyState from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

const emptyForm = {
  code: "",
  description: "",
  type: "percentage",
  value: "",
  maxDiscount: "",
  minOrderValue: "",
  appliesTo: [],
  usageLimit: "",
  validUntil: "",
  isActive: true,
};

/** "YYYY-MM-DD" from the Date's local calendar, for <input type="date">. */
const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function AdminCoupons() {
  const toast = useToast();

  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setCoupons(await getCoupons());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getCategories()
      .then((data) => setCategories(data.map((c) => c.name)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    if (!term) return coupons;
    return coupons.filter(
      (c) =>
        c.code.toUpperCase().includes(term) ||
        (c.description || "").toUpperCase().includes(term)
    );
  }, [coupons, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (coupon) => {
    setEditing(coupon._id);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      type: coupon.type,
      value: String(coupon.value),
      maxDiscount: String(coupon.maxDiscount || 0),
      minOrderValue: String(coupon.minOrderValue || 0),
      appliesTo: coupon.appliesTo || [],
      usageLimit: String(coupon.usageLimit || 0),
      validUntil: toDateInput(coupon.validUntil),
      isActive: coupon.isActive !== false,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const code = form.code.trim().toUpperCase();

    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      toast.error("Code must be 4-20 letters or numbers, no spaces.");
      setSaving(false);
      return;
    }

    const payload = {
      description: form.description,
      type: form.type,
      value: Number(form.value),
      maxDiscount: Number(form.maxDiscount) || 0,
      minOrderValue: Number(form.minOrderValue) || 0,
      appliesTo: form.appliesTo,
      usageLimit: Number(form.usageLimit) || 0,
      validUntil: form.validUntil ? new Date(form.validUntil) : null,
      isActive: form.isActive,
    };

    try {
      if (editing) {
        await updateCoupon(editing, payload);
        toast.success("Coupon updated");
      } else {
        await createCoupon({ ...payload, code });
        toast.success("Coupon created");
      }

      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    setBusyId(coupon._id);

    try {
      const updated = await updateCoupon(coupon._id, {
        isActive: !coupon.isActive,
      });
      setCoupons((current) =>
        current.map((c) => (c._id === coupon._id ? updated : c))
      );
      toast.success(
        updated.isActive ? `${updated.code} is now active` : `${updated.code} paused`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (coupon) => {
    if (
      !window.confirm(
        `Permanently delete "${coupon.code}"?\n\nIf you only want to stop customers using it, pause it instead — that keeps its history.`
      )
    ) {
      return;
    }

    setBusyId(coupon._id);

    try {
      await deleteCoupon(coupon._id);
      setCoupons((current) => current.filter((c) => c._id !== coupon._id));
      toast.success("Coupon deleted");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleCategory = (name) =>
    setForm((p) => ({
      ...p,
      appliesTo: p.appliesTo.includes(name)
        ? p.appliesTo.filter((c) => c !== name)
        : [...p.appliesTo, name],
    }));

  // --- Status helpers -----------------------------------------------

  const expiryState = (coupon) => {
    if (!coupon.validUntil) return { label: "No expiry", tone: "bg-sand-100 text-sand-600" };
    if (new Date(coupon.validUntil) < new Date())
      return { label: "Expired", tone: "bg-red-50 text-red-700" };
    return {
      label: `Until ${new Date(coupon.validUntil).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
      tone: "bg-sand-100 text-sand-600",
    };
  };

  const usageState = (coupon) => {
    if (!coupon.usageLimit) return { label: `${coupon.usedCount} used`, tone: "bg-sand-100 text-sand-600" };
    const left = Math.max(0, coupon.usageLimit - coupon.usedCount);
    return {
      label: left > 0 ? `${coupon.usedCount}/${coupon.usageLimit} used` : "Fully claimed",
      tone: left > 0 ? "bg-sand-100 text-sand-600" : "bg-red-50 text-red-700",
    };
  };

  const describeValue = (coupon) =>
    coupon.type === "percentage"
      ? `${coupon.value}% off${
          coupon.maxDiscount > 0 ? ` (max ₹${coupon.maxDiscount})` : ""
        }`
      : `₹${coupon.value} off`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">
            Discount codes
          </h1>
          <p className="mt-1 text-sm text-sand-500">
            Create and pause the codes customers enter at checkout
          </p>
        </div>

        <button
          onClick={openCreate}
          className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          <Plus size={17} />
          New coupon
        </button>
      </div>

      {coupons.length > 0 && (
        <div className="card p-4">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or description…"
              aria-label="Search coupons"
              className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={search ? "No matching codes" : "No discount codes yet"}
          message={
            search
              ? "Try a different search term."
              : "Create a code and customers can enter it at checkout for a reduced total."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((coupon, i) => {
            const expiry = expiryState(coupon);
            const usage = usageState(coupon);
            const inactive = coupon.isActive === false;

            return (
              <motion.div
                key={coupon._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                className={`card p-5 ${inactive ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-brand-700">
                        {coupon.code}
                      </span>

                      {inactive && (
                        <span className="flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-semibold text-sand-600">
                          <Ban size={11} />
                          Paused
                        </span>
                      )}

                      {coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit && (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                          Fully claimed
                        </span>
                      )}
                    </div>

                    {coupon.description && (
                      <p className="mt-2 text-sm text-sand-500">
                        {coupon.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => openEdit(coupon)}
                      className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                      aria-label={`Edit ${coupon.code}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon)}
                      disabled={busyId === coupon._id}
                      className="rounded-lg p-2 text-sand-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Delete ${coupon.code}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Value */}
                <p className="mt-4 font-display text-xl font-bold text-sand-900">
                  {describeValue(coupon)}
                </p>

                {/* Conditions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {coupon.minOrderValue > 0 && (
                    <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-medium text-sand-600">
                      Min order ₹{coupon.minOrderValue.toLocaleString("en-IN")}
                    </span>
                  )}

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${expiry.tone}`}>
                    <Clock size={10} className="mr-1 inline" />
                    {expiry.label}
                  </span>

                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${usage.tone}`}>
                    {usage.label}
                  </span>
                </div>

                {coupon.appliesTo?.length > 0 && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-xs text-sand-500">
                    <Layers size={13} className="mt-0.5 shrink-0" />
                    <span>Only: {coupon.appliesTo.join(", ")}</span>
                  </p>
                )}

                <button
                  onClick={() => toggleActive(coupon)}
                  disabled={busyId === coupon._id}
                  className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    inactive
                      ? "bg-brand-700 text-white hover:bg-brand-800"
                      : "border border-sand-200 text-sand-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {busyId === coupon._id ? (
                    <Loader2 size={15} className="mx-auto animate-spin" />
                  ) : inactive ? (
                    "Reactivate this code"
                  ) : (
                    "Pause this code"
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / edit drawer */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={editing ? "Edit coupon" : "New coupon"}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-[96] flex w-full max-w-xl flex-col bg-sand-50 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-sand-900">
                    {editing ? "Edit coupon" : "New discount code"}
                  </h2>
                  {editing && (
                    <p className="text-xs text-sand-500">
                      The code itself can't be changed once created.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Code *
                    </label>
                    <input
                      required
                      disabled={Boolean(editing)}
                      value={form.code}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                        }))
                      }
                      placeholder="HARVEST10"
                      className={`mt-1.5 ${field} font-mono uppercase ${
                        editing ? "cursor-not-allowed bg-sand-100 text-sand-400" : ""
                      }`}
                    />
                    <p className="mt-1 text-xs text-sand-400">
                      4-20 letters or numbers, no spaces.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Discount type
                    </label>
                    <select value={form.type} onChange={set("type")} className={`mt-1.5 ${field}`}>
                      <option value="percentage">Percentage off</option>
                      <option value="flat">Flat amount off</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Description
                  </label>
                  <input
                    value={form.description}
                    onChange={set("description")}
                    placeholder="10% off orders over ₹500"
                    className={`mt-1.5 ${field}`}
                  />
                  <p className="mt-1 text-xs text-sand-400">
                    Shown to the customer once the code is applied.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      {form.type === "percentage" ? "Percent off *" : "Rupees off *"}
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      step={form.type === "percentage" ? "1" : "1"}
                      max={form.type === "percentage" ? "100" : undefined}
                      value={form.value}
                      onChange={set("value")}
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  {form.type === "percentage" && (
                    <div>
                      <label className="text-sm font-semibold text-sand-700">
                        Max discount
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.maxDiscount}
                        onChange={set("maxDiscount")}
                        placeholder="0"
                        className={`mt-1.5 ${field}`}
                      />
                      <p className="mt-1 text-xs text-sand-400">₹ cap, 0 = none</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Min order
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.minOrderValue}
                      onChange={set("minOrderValue")}
                      placeholder="0"
                      className={`mt-1.5 ${field}`}
                    />
                    <p className="mt-1 text-xs text-sand-400">₹, 0 = none</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Usage limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.usageLimit}
                      onChange={set("usageLimit")}
                      placeholder="0"
                      className={`mt-1.5 ${field}`}
                    />
                    <p className="mt-1 text-xs text-sand-400">
                      0 = unlimited. {form.usageLimit > 0 && `Uses so far: ${editing ? "see card" : "0"}.`}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Valid until
                    </label>
                    <input
                      type="date"
                      value={form.validUntil}
                      onChange={set("validUntil")}
                      className={`mt-1.5 ${field}`}
                    />
                    <p className="mt-1 text-xs text-sand-400">Leave blank for no expiry</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Restrict to categories
                  </label>

                  {categories.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {categories.map((name) => {
                        const on = form.appliesTo.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleCategory(name)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              on
                                ? "bg-brand-700 text-white"
                                : "bg-white text-sand-600 ring-1 ring-sand-200 hover:bg-brand-50"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-sand-400">Loading categories…</p>
                  )}

                  <p className="mt-2 text-xs text-sand-400">
                    {form.appliesTo.length === 0
                      ? "No selection = applies to everything."
                      : `Applies only to: ${form.appliesTo.join(", ")}`}
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                  />
                  Active — customers can use this code
                </label>
              </form>

              <div className="flex gap-3 border-t border-sand-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-sand-200 px-5 py-3 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {editing ? "Save changes" : "Create coupon"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
