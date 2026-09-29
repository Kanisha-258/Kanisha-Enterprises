import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  getAdminBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../../api/blogApi";
import EmptyState from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";

const emptyPost = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  tags: "",
  isPublished: true,
};

/** Turns "Kharif Season Guide" into "kharif-season-guide". */
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const field =
  "w-full rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200";

export default function AdminBlog() {
  const toast = useToast();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const data = await getAdminBlogs({ limit: 50 });
      setPosts(data.blogs || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyPost);
    setShowForm(true);
  };

  const openEdit = (post) => {
    setEditing(post._id);
    setForm({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage || "",
      tags: (post.tags || []).join(", "),
      isPublished: post.isPublished !== false,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      // Let the backend generate a slug when creating.
      ...(editing ? {} : { slug: slugify(form.title) }),
    };

    try {
      if (editing) {
        await updateBlog(editing, payload);
        toast.success("Post updated");
      } else {
        await createBlog(payload);
        toast.success("Post created");
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

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    try {
      await deleteBlog(post._id);
      setPosts((current) => current.filter((p) => p._id !== post._id));
      toast.success("Post deleted");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-sand-900">Blog posts</h1>
          <p className="mt-1 text-sm text-sand-500">
            Seasonal guides and farming advice
          </p>
        </div>

        <button
          onClick={openCreate}
          className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          <Plus size={17} />
          New post
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No blog posts yet"
          message="Write your first seasonal guide to help customers plan ahead."
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <motion.div
              key={post._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-sand-900">{post.title}</h2>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        post.isPublished
                          ? "bg-brand-50 text-brand-700"
                          : "bg-sand-100 text-sand-500"
                      }`}
                    >
                      {post.isPublished ? (
                        <>
                          <Eye size={11} />
                          Published
                        </>
                      ) : (
                        <>
                          <EyeOff size={11} />
                          Draft
                        </>
                      )}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-sand-500">
                    {post.excerpt}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-sand-400">
                    <span>/blog/{post.slug}</span>
                    <span>
                      {new Date(post.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {post.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-sand-100 px-2 py-0.5 font-semibold text-sand-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {post.isPublished && (
                    <Link
                      to={`/blog/${post.slug}`}
                      className="rounded-lg p-2 text-sand-500 transition hover:bg-sand-100 hover:text-brand-700"
                      aria-label={`View ${post.title}`}
                    >
                      <FileText size={16} />
                    </Link>
                  )}
                  <button
                    onClick={() => openEdit(post)}
                    className="rounded-lg p-2 text-sand-500 transition hover:bg-brand-50 hover:text-brand-700"
                    aria-label={`Edit ${post.title}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(post)}
                    className="rounded-lg p-2 text-sand-500 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${post.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Editor */}
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
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-[96] flex w-full max-w-2xl flex-col bg-sand-50 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={editing ? "Edit post" : "New post"}
            >
              <div className="flex items-center justify-between border-b border-sand-200 bg-white px-6 py-4">
                <h2 className="font-display text-lg font-bold text-sand-900">
                  {editing ? "Edit post" : "Write a new post"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto p-6">
                <div>
                  <label className="text-sm font-semibold text-sand-700">Title *</label>
                  <input required value={form.title} onChange={set("title")} className={`mt-1.5 ${field}`} />

                  {!editing && form.title && (
                    <p className="mt-1.5 text-xs text-sand-400">
                      URL: /blog/{slugify(form.title)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Short summary *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={form.excerpt}
                    onChange={set("excerpt")}
                    placeholder="One or two sentences shown on the blog index"
                    className={`mt-1.5 resize-none ${field}`}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Full article *
                  </label>
                  <textarea
                    required
                    rows={14}
                    value={form.content}
                    onChange={set("content")}
                    placeholder={"Write your article here.\n\nLeave a blank line between paragraphs.\n\nA short ALL CAPS line on its own becomes a subheading."}
                    className={`mt-1.5 resize-y font-mono text-[13px] leading-relaxed ${field}`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Cover image path
                    </label>
                    <input
                      value={form.coverImage}
                      onChange={set("coverImage")}
                      placeholder="/blog/example.jpg"
                      className={`mt-1.5 ${field}`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Tags
                    </label>
                    <input
                      value={form.tags}
                      onChange={set("tags")}
                      placeholder="kharif, monsoon, paddy"
                      className={`mt-1.5 ${field}`}
                    />
                    <p className="mt-1 text-xs text-sand-400">Comma separated</p>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-sand-700">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isPublished: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-sand-300 text-brand-600 focus:ring-brand-400"
                  />
                  Publish immediately
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
                  disabled={saving}
                  className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editing ? "Save changes" : "Publish post"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
