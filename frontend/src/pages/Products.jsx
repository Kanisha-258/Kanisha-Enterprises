import { useCallback, useEffect, useMemo, useState, createElement } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, PackageSearch, ChevronDown } from "lucide-react";

import { getProducts, getCategories } from "../api/productApi";
import ProductCard from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import { getCategoryIcon } from "../data/products";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "name_asc", label: "Name: A to Z" },
];

const PER_PAGE = 12;

export default function Products() {
  // Filter state lives in the URL so a filtered view can be shared or bookmarked.
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Search box is kept separate so typing doesn't spam the API on every keystroke.
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const category = searchParams.get("category") || "All";
  const subcategory = searchParams.get("subcategory") || "All";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = Number(searchParams.get("page")) || 1;
  const inStock = searchParams.get("inStock") === "true";

  /** Updates the URL, which is the single source of truth for filters. */
  const updateParams = useCallback(
    (changes, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(changes).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined || value === "All") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });

      if (resetPage) next.delete("page");

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Keep the input in step when the URL changes from elsewhere (e.g. the nav search).
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Debounce the search box into the URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, search, updateParams]);

  // Load the category list once.
  useEffect(() => {
    let cancelled = false;

    getCategories()
      .then((data) => {
        if (!cancelled) setCategories(data || []);
      })
      .catch(() => {
        // Filters still work from the hardcoded list below.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch products whenever any filter changes.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getProducts({
          category: category === "All" ? undefined : category,
          subcategory: subcategory === "All" ? undefined : subcategory,
          search: search || undefined,
          sort,
          page,
          limit: PER_PAGE,
          inStock: inStock ? "true" : undefined,
        });

        if (cancelled) return;

        setProducts(data.products || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [category, subcategory, search, sort, page, inStock]);

  const subcategories = useMemo(
    () => categories.find((c) => c.name === category)?.subcategories ?? [],
    [categories, category]
  );

  const activeFilterCount =
    (category !== "All" ? 1 : 0) +
    (subcategory !== "All" ? 1 : 0) +
    (search ? 1 : 0) +
    (inStock ? 1 : 0);

  const clearAll = () => setSearchParams({}, { replace: true });

  const title = category === "All" ? "All products" : category;

  // Built here rather than assigned to a capitalised variable, so React
  // treats it as an element instead of a new component type per render.
  const categoryIcon = createElement(getCategoryIcon(category), {
    size: 30,
    className: "text-brand-600",
  });

  return (
    <section className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Catalogue
            </p>

            <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              {category !== "All" && categoryIcon}
              {title}
            </h1>

            <p className="mt-2 text-sand-500">
              {loading
                ? "Loading products…"
                : `${total} product${total === 1 ? "" : "s"} available`}
            </p>
          </div>

          {/* Search + sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products…"
                aria-label="Search products"
                className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-64"
              />
            </div>

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => updateParams({ sort: e.target.value })}
                aria-label="Sort products"
                className="w-full appearance-none rounded-xl border border-sand-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-48"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sand-400"
              />
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-sand-700 transition hover:border-brand-300 lg:hidden"
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Sidebar filters */}
          <aside
            className={`${filtersOpen ? "block" : "hidden"} lg:block`}
            aria-label="Product filters"
          >
            <div className="space-y-6 lg:sticky lg:top-24">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAll}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white py-2.5 text-sm font-semibold text-sand-600 transition hover:border-red-300 hover:text-red-600"
                >
                  <X size={15} />
                  Clear all filters
                </button>
              )}

              {/* Categories */}
              <div className="card p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-sand-500">
                  Category
                </h2>

                <ul className="mt-4 space-y-1">
                  <li>
                    <button
                      onClick={() => updateParams({ category: "All", subcategory: "All" })}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        category === "All"
                          ? "bg-brand-700 text-white"
                          : "text-sand-600 hover:bg-sand-100"
                      }`}
                    >
                      All products
                    </button>
                  </li>

                  {categories.map((cat) => {
                    const CatIcon = getCategoryIcon(cat.name);
                    const active = category === cat.name;

                    return (
                      <li key={cat.name}>
                        <button
                          onClick={() =>
                            updateParams({
                              category: active ? "All" : cat.name,
                              subcategory: "All",
                            })
                          }
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-brand-700 text-white"
                              : "text-sand-600 hover:bg-sand-100"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <CatIcon size={16} className="shrink-0" />
                            <span className="truncate">{cat.name}</span>
                          </span>
                          <span
                            className={`shrink-0 text-xs ${
                              active ? "text-brand-100" : "text-sand-400"
                            }`}
                          >
                            {cat.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Subcategories */}
              <AnimatePresence>
                {subcategories.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="card overflow-hidden p-5"
                  >
                    <h2 className="text-sm font-bold uppercase tracking-wider text-sand-500">
                      {category}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => updateParams({ subcategory: "All" })}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          subcategory === "All"
                            ? "bg-brand-700 text-white"
                            : "bg-sand-100 text-sand-600 hover:bg-brand-100"
                        }`}
                      >
                        All
                      </button>

                      {subcategories.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => updateParams({ subcategory: sub })}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            subcategory === sub
                              ? "bg-brand-700 text-white"
                              : "bg-sand-100 text-sand-600 hover:bg-brand-100"
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Availability */}
              <div className="card p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-sand-500">
                  Availability
                </h2>

                <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-medium text-sand-600">
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={(e) =>
                      updateParams({ inStock: e.target.checked ? "true" : "" })
                    }
                    className="h-4 w-4 cursor-pointer rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                  />
                  In stock only
                </label>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div>
            {loading && <ProductGridSkeleton count={PER_PAGE} />}

            {!loading && error && <ErrorState message={error} />}

            {!loading && !error && products.length === 0 && (
              <EmptyState
                icon={PackageSearch}
                title="No products found"
                message="Try a different category, or clear your filters to see everything we have in store."
                action="/products"
                actionLabel="Reset filters"
              />
            )}

            {!loading && !error && products.length > 0 && (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((product, i) => (
                    <ProductCard key={product._id} product={product} index={i} />
                  ))}
                </div>

                <Pagination
                  className="mt-12"
                  page={page}
                  totalPages={totalPages}
                  onChange={(p) => {
                    updateParams({ page: p === 1 ? "" : p }, { resetPage: false });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
