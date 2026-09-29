import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// AnimatePresence is deliberately not used for the product form. Its exit
// animation completed but the node stayed mounted, leaving a strip that
// swallowed clicks. useSlideOver removes the nodes outright instead.
import useSlideOver from "../../hooks/useSlideOver";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  PackageX,
  Star,
} from "lucide-react";

import {
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../api/productApi";
import { getCategories } from "../../api/productApi";
import ProductImage from "../../components/ui/ProductImage";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const emptyProduct = {
  name: "",
  slug: "",
  category: "",
  subcategory: "",
  description: "",
  details: "",
  usage: "",
  price: "",
  discountPrice: "",
  unit: "",
  brand: "",
  stock: "0",
  image: "",
  highlights: [],
  isFeatured: false,
  isActive: true,
};

/** "Premium Paddy Seeds" -> "premium-paddy-seeds" */
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function AdminProducts() {
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const formPanel = useSlideOver(showForm);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [highlightInput, setHighlightInput] = useState("");

  const load = async () => {
    try {
      setLoading(true);

      const data = await getAdminProducts({
        page,
        limit: 20,
        search: search || undefined,
        category: category === "All" ? undefined : category,
      });

      setProducts(data.products || []);
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
  }, [page, search, category]);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyProduct);
    setHighlightInput("");
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditing(product._id);
    setForm({
      name: product.name || "",
      slug: product.slug || "",
      category: product.category || "",
      subcategory: product.subcategory || "",
      description: product.description || "",
      details: product.details || "",
      usage: product.usage || "",
      price: product.price ?? "",
      discountPrice: product.discountPrice ?? 0,
      unit: product.unit || "",
      brand: product.brand || "",
      stock: product.stock ?? 0,
      image: product.image || "",
      highlights: product.highlights || [],
      isFeatured: Boolean(product.isFeatured),
      isActive: product.isActive !== false,
    });
    setHighlightInput((product.highlights || []).join("\n"));
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Textarea -> array, dropping blank lines.
    const highlights = highlightInput
      .split("\n")
      .map((h) => h.trim())
      .filter(Boolean);

    const payload = { ...form, highlights, stock: Number(form.stock) || 0 };

    try {
      if (editing) {
        await updateProduct(editing, payload);
        toast.success("Product updated");
      } else {
        await createProduct(payload);
        toast.success("Product created");
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

  const handleDelete = async (product) => {
    if (
      !window.confirm(
        `Remove "${product.name}" from the catalogue?\n\nIt will be hidden from customers but kept in your order history.`
      )
    ) {
      return;
    }

    try {
      await deleteProduct(product._id);
      toast.success("Product removed");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const subcategories =
    categories.find((c) => c.name === form.category)?.subcategories ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Products</h1>
          <p className="mt-1 text-sm text-sand-500">
            {products.length} shown · manage your catalogue
          </p>
        </div>

        <button
          onClick={openCreate}
          className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          <Plus size={17} />
          Add product
        </button>
      </div>

      {/* Filters. The shared `field` class is w-full, which would let the
          select swallow the row inside a flex layout — so widths are set
          explicitly here instead. */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:min-w-0 sm:flex-1">
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
              placeholder="Search by name, SKU or brand…"
              aria-label="Search products"
              className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-medium transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-56 sm:shrink-0"
          >
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={PackageX}
          title="No products found"
          message={
            search || category !== "All"
              ? "Try a different search or filter."
              : "Add your first product to start selling."
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-sand-200 bg-sand-50 text-xs font-bold uppercase tracking-wider text-sand-500">
                <tr>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Price</th>
                  <th className="px-5 py-3.5">Stock</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-sand-100">
                <AnimatePresence initial={false}>
                  {products.map((product) => (
                    <motion.tr
                      key={product._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="transition hover:bg-sand-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                            <ProductImage
                              src={product.image}
                              alt=""
                              name={product.name}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate font-semibold text-sand-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-sand-400">
                              {product.sku} · {product.unit}
                            </p>
                            {product.numReviews > 0 && (
                              <p className="flex items-center gap-1 text-xs text-sand-500">
                                <Star size={11} className="fill-wheat-400 text-wheat-400" />
                                {product.rating} ({product.numReviews})
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-sand-600">
                        {product.category}
                        {product.subcategory && (
                          <span className="block text-xs text-sand-400">
                            {product.subcategory}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-sand-900">
                          ₹{Number(
                            product.discountPrice > 0 && product.discountPrice < product.price
                              ? product.discountPrice
                              : product.price
                          ).toLocaleString("en-IN")}
                        </span>
                        {product.discountPrice > 0 &&
                          product.discountPrice < product.price && (
                            <span className="block text-xs text-sand-400 line-through">
                              ₹{Number(product.price).toLocaleString("en-IN")}
                            </span>
                          )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            product.stock <= 0
                              ? "bg-red-50 text-red-700"
                              : product.stock <= 5
                                ? "bg-wheat-50 text-wheat-700"
                                : "bg-brand-50 text-brand-700"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.isActive
                              ? "bg-brand-50 text-brand-700"
                              : "bg-sand-100 text-sand-500"
                          }`}
                        >
                          {product.isActive ? "Active" : "Hidden"}
                        </span>

                        {product.isFeatured && (
                          <span className="ml-1.5 rounded-full bg-wheat-50 px-2 py-1 text-xs font-semibold text-wheat-700">
                            Featured
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(product)}
                            className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="rounded-lg p-2 text-sand-500 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${product.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
        />
      )}

      {/* Create / edit form. A plain CSS transition rather than
          AnimatePresence: the exit animation completed but the node stayed
          mounted, leaving a strip that swallowed clicks. See useSlideOver. */}
      {formPanel.mounted && (
        <>
          <div
            onClick={() => setShowForm(false)}
            className={`fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm transition-opacity duration-300 ${
              formPanel.shown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit product" : "Add product"}
            className={`fixed inset-y-0 right-0 z-[96] flex w-full max-w-xl flex-col bg-sand-50 shadow-2xl transition-transform duration-300 ease-out ${
              formPanel.shown ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
                <h2 className="font-display text-lg font-bold text-sand-900">
                  {editing ? "Edit product" : "Add a new product"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
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
                id="product-form"
                onSubmit={handleSave}
                className="flex-1 space-y-5 overflow-y-auto p-6"
              >
                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Product name *
                  </label>
                  <input required value={form.name} onChange={set("name")} className={`mt-1.5 ${field}`} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Web address (slug)
                  </label>
                  <input
                    value={form.slug}
                    onChange={set("slug")}
                    placeholder={slugify(form.name) || "auto-generated"}
                    className={`mt-1.5 ${field} font-mono text-[13px]`}
                  />
                  <p className="mt-1 text-xs text-sand-400">
                    Leave blank to generate it from the name. The page will live at{" "}
                    <span className="font-mono">
                      /products/{form.slug || slugify(form.name) || "…"}
                    </span>
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Category *
                    </label>
                    <select required value={form.category} onChange={set("category")} className={`mt-1.5 ${field}`}>
                      <option value="">Select…</option>
                      {categories.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Subcategory
                    </label>
                    {subcategories.length > 0 ? (
                      <select value={form.subcategory} onChange={set("subcategory")} className={`mt-1.5 ${field}`}>
                        <option value="">None</option>
                        {subcategories.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input value={form.subcategory} onChange={set("subcategory")} className={`mt-1.5 ${field}`} />
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Price (₹) *
                    </label>
                    <input required type="number" min="0" value={form.price} onChange={set("price")} className={`mt-1.5 ${field}`} />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Offer price (₹)
                    </label>
                    <input type="number" min="0" value={form.discountPrice} onChange={set("discountPrice")} className={`mt-1.5 ${field}`} />
                    <p className="mt-1 text-xs text-sand-400">Leave 0 for no discount</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Stock
                    </label>
                    <input type="number" min="0" value={form.stock} onChange={set("stock")} className={`mt-1.5 ${field}`} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Pack size
                    </label>
                    <input value={form.unit} onChange={set("unit")} placeholder="e.g. 10 kg, 1 L" className={`mt-1.5 ${field}`} />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Brand
                    </label>
                    <input value={form.brand} onChange={set("brand")} className={`mt-1.5 ${field}`} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Image path *
                  </label>
                  <input required value={form.image} onChange={set("image")} placeholder="/products/example.jpg" className={`mt-1.5 ${field}`} />
                  <p className="mt-1 text-xs text-sand-400">
                    Put the image file in <code>frontend/public/products/</code> and
                    reference it like this. If it's missing, a placeholder is shown
                    instead of a broken image.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Short description
                  </label>
                  <textarea rows={3} value={form.description} onChange={set("description")} className={`mt-1.5 resize-none ${field}`} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Full details
                  </label>
                  <textarea rows={4} value={form.details} onChange={set("details")} className={`mt-1.5 resize-none ${field}`} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    How to use
                  </label>
                  <textarea rows={3} value={form.usage} onChange={set("usage")} className={`mt-1.5 resize-none ${field}`} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Highlights (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    placeholder={"High germination\n10 kg pack\nSuitable for all regions"}
                    className={`mt-1.5 resize-none ${field}`}
                  />
                </div>

                <div className="flex flex-wrap gap-5">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                      className="h-4 w-4 rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                    />
                    Visible to customers
                  </label>

                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-700">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))}
                      className="h-4 w-4 rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                    />
                    Show on the homepage
                  </label>
                </div>
              </form>

              <div className="flex gap-3 border-t border-sand-200 bg-white px-6 py-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-sand-200 px-5 py-3 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="product-form"
                  disabled={saving}
                  className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editing ? "Save changes" : "Create product"}
                </button>
              </div>
          </div>
        </>
      )}
    </div>
  );
}
