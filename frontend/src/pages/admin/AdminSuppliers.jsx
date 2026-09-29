import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Loader2,
  X,
  Check,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  Ban,
  Package,
  IndianRupee,
  Users,
  Truck,
} from "lucide-react";

// AnimatePresence is deliberately not used for the drawers. Its exit
// animation completed but the node stayed mounted, leaving a strip that
// swallowed clicks. useSlideOver removes the nodes outright instead.
import useSlideOver from "../../hooks/useSlideOver";

import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../../api/inventoryApi";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

const emptyForm = {
  name: "",
  companyName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  gstin: "",
  notes: "",
  isActive: true,
};

export default function AdminSuppliers() {
  const toast = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const drawerPanel = useSlideOver(drawerOpen);

  // Detail panel
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailPanel = useSlideOver(Boolean(detail));

  const load = async () => {
    try {
      setLoading(true);

      const data = await getSuppliers({
        page,
        limit: 20,
        search: search || undefined,
        isActive: status,
      });

      setSuppliers(data.suppliers || []);
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

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = async (supplier) => {
    setEditing(supplier._id);
    setForm({
      name: supplier.name || "",
      companyName: supplier.companyName || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      gstin: supplier.gstin || "",
      notes: supplier.notes || "",
      isActive: supplier.isActive !== false,
    });
    setDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Normalised here too, so the user sees the same value that gets stored.
    const payload = {
      ...form,
      gstin: form.gstin.trim().toUpperCase(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.replace(/\D/g, ""),
    };

    try {
      if (editing) {
        await updateSupplier(editing, payload);
        toast.success("Supplier updated");
      } else {
        await createSupplier(payload);
        toast.success("Supplier added");
      }

      setDrawerOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (supplier) => {
    setBusyId(supplier._id);

    try {
      const result = await deleteSupplier(supplier._id);

      setSuppliers((current) =>
        current.map((s) => (s._id === supplier._id ? { ...s, isActive: false } : s))
      );

      toast.success(result.message || "Supplier deactivated");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const reactivate = async (supplier) => {
    setBusyId(supplier._id);

    try {
      const updated = await updateSupplier(supplier._id, { isActive: true });

      setSuppliers((current) =>
        current.map((s) => (s._id === supplier._id ? updated : s))
      );

      toast.success(`${supplier.name} is active again`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (supplier) => {
    setDetailLoading(true);
    setDetail({ supplier, stats: null, purchases: [] });

    try {
      setDetail(await getSupplier(supplier._id));
    } catch (err) {
      toast.error(err.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const shortDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Suppliers</h1>
          <p className="mt-1 text-sm text-sand-500">
            Who you buy stock from, and what you've bought from them
          </p>
        </div>

        <button
          onClick={openCreate}
          className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          <Plus size={17} />
          New supplier
        </button>
      </div>

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
            placeholder="Search by name, company, phone, GSTIN or city…"
            aria-label="Search suppliers"
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
          <option value="all">All suppliers</option>
          <option value="true">Active only</option>
          <option value="false">Deactivated only</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? "No matching suppliers" : "No suppliers yet"}
          message={
            search
              ? "Try a different name, phone number or GSTIN."
              : "Add the businesses you buy stock from. You'll then be able to record purchases against them."
          }
          action={!search && { label: "Add your first supplier", onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {suppliers.map((supplier, i) => {
            const inactive = supplier.isActive === false;

            return (
              <motion.div
                key={supplier._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                className={`card p-5 ${inactive ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-sand-900">
                        {supplier.name}
                      </h3>

                      {inactive && (
                        <span className="flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-semibold text-sand-600">
                          <Ban size={11} />
                          Deactivated
                        </span>
                      )}
                    </div>

                    {supplier.companyName && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-sand-500">
                        <Building2 size={13} />
                        {supplier.companyName}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => openEdit(supplier)}
                      className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                      aria-label={`Edit ${supplier.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>

                {/* Contact */}
                <dl className="mt-4 space-y-1.5 text-sm text-sand-600">
                  {supplier.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="shrink-0 text-sand-400" />
                      <a href={`tel:${supplier.phone}`} className="hover:text-brand-700">
                        {supplier.phone}
                      </a>
                    </div>
                  )}

                  {supplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="shrink-0 text-sand-400" />
                      <a href={`mailto:${supplier.email}`} className="truncate hover:text-brand-700">
                        {supplier.email}
                      </a>
                    </div>
                  )}

                  {(supplier.city || supplier.state) && (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="shrink-0 text-sand-400" />
                      {[supplier.city, supplier.state].filter(Boolean).join(", ")}
                    </div>
                  )}

                  {supplier.gstin && (
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="shrink-0 text-sand-400" />
                      <span className="font-mono text-xs">{supplier.gstin}</span>
                    </div>
                  )}
                </dl>

                {supplier.notes && (
                  <p className="mt-3 rounded-xl bg-sand-50 px-3.5 py-2.5 text-sm text-sand-600">
                    {supplier.notes}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openDetail(supplier)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sand-200 py-2.5 text-sm font-semibold text-sand-600 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    <Package size={15} />
                    View purchases
                  </button>

                  {inactive ? (
                    <button
                      onClick={() => reactivate(supplier)}
                      disabled={busyId === supplier._id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
                    >
                      {busyId === supplier._id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                      Reactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleActive(supplier)}
                      disabled={busyId === supplier._id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sand-200 py-2.5 text-sm font-semibold text-sand-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                    >
                      {busyId === supplier._id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Ban size={15} />
                      )}
                      Deactivate
                    </button>
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
            aria-label={editing ? "Edit supplier" : "New supplier"}
            className={`fixed inset-y-0 right-0 z-[96] flex w-full max-w-xl flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out ${
              drawerPanel.shown ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
                <h2 className="font-display text-lg font-bold text-sand-900">
                  {editing ? "Edit supplier" : "New supplier"}
                </h2>

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
                id="supplier-form"
                onSubmit={handleSave}
                className="flex-1 space-y-5 overflow-y-auto p-6"
              >
                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Contact name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Ramesh Patil"
                    className={`mt-1.5 ${field}`}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Company / trading name
                  </label>
                  <input
                    value={form.companyName}
                    onChange={set("companyName")}
                    placeholder="Patil Agro Traders"
                    className={`mt-1.5 ${field}`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">Phone</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        }))
                      }
                      placeholder="9876543210"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="sales@example.com"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">Address</label>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={set("address")}
                    placeholder="Shop 14, Market Yard"
                    className={`mt-1.5 ${field} resize-none`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">City</label>
                    <input
                      value={form.city}
                      onChange={set("city")}
                      placeholder="Nashik"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">State</label>
                    <input
                      value={form.state}
                      onChange={set("state")}
                      placeholder="Maharashtra"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">GSTIN</label>
                  <input
                    value={form.gstin}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      }))
                    }
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                    className={`mt-1.5 ${field} font-mono`}
                  />
                  <p className="mt-1 text-xs text-sand-400">
                    Leave blank if they aren't GST-registered. Only one supplier can
                    use a given GSTIN.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={set("notes")}
                    placeholder="Delivery days, payment terms, minimum order…"
                    className={`mt-1.5 ${field} resize-none`}
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                  />
                  Active — you can record purchases from them
                </label>
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
                  form="supplier-form"
                  disabled={saving}
                  className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editing ? "Save changes" : "Add supplier"}
                </button>
              </div>
          </div>
        </>
      )}

      {/* Detail drawer, same approach. */}
      {detailPanel.mounted && detail && (
        <>
          <div
            onClick={() => setDetail(null)}
            className={`fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm transition-opacity duration-300 ${
              detailPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${detail.supplier.name} details`}
            className={`fixed inset-y-0 right-0 z-[96] flex w-full max-w-lg flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out ${
              detailPanel.shown ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
              <div className="flex items-start justify-between border-b border-sand-200 bg-white px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold text-sand-900">
                    {detail.supplier.name}
                  </h2>
                  {detail.supplier.companyName && (
                    <p className="truncate text-sm text-sand-500">
                      {detail.supplier.companyName}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setDetail(null)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {/* Stats */}
                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-brand-500" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Total spent", value: rupees(detail.stats?.totalSpend), icon: IndianRupee },
                        { label: "Purchases", value: detail.stats?.purchaseCount ?? 0, icon: Package },
                        { label: "Units bought", value: detail.stats?.unitsBought ?? 0, icon: Users },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="card p-3 text-center">
                          <Icon size={16} className="mx-auto text-brand-600" />
                          <p className="mt-1.5 font-display text-lg font-bold text-sand-900">
                            {value}
                          </p>
                          <p className="text-[11px] text-sand-500">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Contact */}
                    <div className="card p-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sand-400">
                        Contact
                      </h3>
                      <dl className="mt-3 space-y-2 text-sm">
                        {detail.supplier.phone && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-sand-500">Phone</dt>
                            <dd className="font-medium text-sand-900">
                              {detail.supplier.phone}
                            </dd>
                          </div>
                        )}
                        {detail.supplier.email && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-sand-500">Email</dt>
                            <dd className="truncate font-medium text-sand-900">
                              {detail.supplier.email}
                            </dd>
                          </div>
                        )}
                        {(detail.supplier.address || detail.supplier.city) && (
                          <div className="flex justify-between gap-4">
                            <dt className="shrink-0 text-sand-500">Address</dt>
                            <dd className="text-right font-medium text-sand-900">
                              {[
                                detail.supplier.address,
                                detail.supplier.city,
                                detail.supplier.state,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </dd>
                          </div>
                        )}
                        {detail.supplier.gstin && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-sand-500">GSTIN</dt>
                            <dd className="font-mono text-xs font-medium text-sand-900">
                              {detail.supplier.gstin}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-4">
                          <dt className="text-sand-500">Added</dt>
                          <dd className="font-medium text-sand-900">
                            {shortDate(detail.supplier.createdAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {detail.supplier.notes && (
                      <div className="card p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-sand-400">
                          Notes
                        </h3>
                        <p className="mt-2 whitespace-pre-line text-sm text-sand-600">
                          {detail.supplier.notes}
                        </p>
                      </div>
                    )}

                    {/* Purchases */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-sand-400">
                        Recent purchases
                      </h3>

                      {detail.purchases.length === 0 ? (
                        <p className="mt-3 rounded-xl bg-white px-4 py-6 text-center text-sm text-sand-400">
                          No purchases recorded from this supplier yet.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {detail.purchases.map((p) => (
                            <li key={p._id} className="card flex items-center justify-between gap-3 p-3.5">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-sm font-semibold text-sand-900">
                                  {p.purchaseNumber}
                                </p>
                                <p className="text-xs text-sand-500">
                                  {shortDate(p.purchaseDate)} ·{" "}
                                  {p.items.reduce((s, i) => s + i.quantity, 0)} units
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-sm font-bold text-sand-900">
                                  {rupees(p.total)}
                                </p>
                                <p
                                  className={`text-[11px] font-semibold ${
                                    p.status === "received"
                                      ? "text-brand-600"
                                      : p.status === "cancelled"
                                        ? "text-red-600"
                                        : "text-sand-400"
                                  }`}
                                >
                                  {p.status}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
          </div>
        </>
      )}
    </div>
  );
}
