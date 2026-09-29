import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, BookOpen, Calendar, Tag as TagIcon, X } from "lucide-react";

import { getBlogs, getBlogTags } from "../api/blogApi";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/Spinner";

const PER_PAGE = 9;

function BlogCard({ post, index }) {
  // The seed data references cover photos that may not have been added yet,
  // so fall back to a branded panel instead of a broken image.
  const [coverFailed, setCoverFailed] = useState(false);

  const date = new Date(post.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.07, 0.4) }}
    >
      <Link
        to={`/blog/${post.slug}`}
        className="card card-hover group flex h-full flex-col overflow-hidden"
      >
        <div className="relative h-44 overflow-hidden bg-sand-100">
          {post.coverImage && !coverFailed ? (
            <img
              src={post.coverImage}
              alt=""
              loading="lazy"
              onError={() => setCoverFailed(true)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br from-brand-700 to-brand-900">
              <span className="absolute inset-0 bg-grain opacity-40" aria-hidden="true" />
              <BookOpen
                size={44}
                className="relative text-white/30 transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-3 text-xs text-sand-400">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {date}
            </span>
          </div>

          <h2 className="mt-3 line-clamp-2 font-display text-lg font-bold leading-snug text-sand-900 transition-colors group-hover:text-brand-700">
            {post.title}
          </h2>

          <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-sand-500">
            {post.excerpt}
          </p>

          {post.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-semibold text-sand-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.article>
  );
}

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const search = searchParams.get("search") || "";
  const tag = searchParams.get("tag") || "";
  const page = Number(searchParams.get("page")) || 1;

  const [searchInput, setSearchInput] = useState(search);

  // Memoised so the debounce effect below can safely depend on it —
  // otherwise it captures a stale copy of the query string.
  const update = useCallback(
    (changes, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(changes).forEach(([key, value]) => {
        if (!value || value === "All") next.delete(key);
        else next.set(key, String(value));
      });

      if (resetPage) next.delete("page");

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) update({ search: searchInput });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, search, update]);

  useEffect(() => {
    getBlogTags()
      .then(setTags)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getBlogs({
          search: search || undefined,
          tag: tag || undefined,
          page,
          limit: PER_PAGE,
        });

        if (cancelled) return;

        setPosts(data.blogs || []);
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
  }, [search, tag, page]);

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
              Knowledge base
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Farming blog
            </h1>
            <p className="mt-2 text-sand-500">
              {loading ? "Loading…" : `${total} article${total === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sand-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles…"
              aria-label="Search blog articles"
              className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-72"
            />
          </div>
        </motion.div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <TagIcon size={15} className="text-sand-400" />

            <button
              onClick={() => update({ tag: "" })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !tag ? "bg-brand-700 text-white" : "bg-white text-sand-600 ring-1 ring-sand-200 hover:bg-sand-50"
              }`}
            >
              All
            </button>

            {tags.map((t) => (
              <button
                key={t}
                onClick={() => update({ tag: tag === t ? "" : t })}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                  tag === t
                    ? "bg-brand-700 text-white"
                    : "bg-white text-sand-600 ring-1 ring-sand-200 hover:bg-sand-50"
                }`}
              >
                {t}
              </button>
            ))}

            {(tag || search) && (
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                <X size={13} />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Posts */}
        <div className="mt-10">
          {loading && <TableSkeleton rows={3} cols={3} />}

          {!loading && error && <ErrorState message={error} />}

          {!loading && !error && posts.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="No articles found"
              message="Try a different search term or clear the filters."
              action="/blog"
              actionLabel="Show all articles"
            />
          )}

          {!loading && !error && posts.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => (
                <BlogCard key={post._id} post={post} index={i} />
              ))}
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <Pagination
              className="mt-12"
              page={page}
              totalPages={totalPages}
              onChange={(p) => {
                update({ page: p === 1 ? "" : p }, { resetPage: false });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
