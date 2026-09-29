import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  UserRound,
  BookOpen,
  Share2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

import { getBlogBySlug } from "../api/blogApi";
import { useToast } from "../components/ui/Toast";
import { ErrorState } from "../components/ui/Spinner";

export default function BlogPost() {
  const { slug } = useParams();
  const toast = useToast();

  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getBlogBySlug(slug);
      setPost(data.blog);
      setRelated(data.related || []);
      setCoverFailed(false);

      document.title = `${data.blog.title} — Kanisha Enterprises`;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Restore the default title when leaving the page.
  useEffect(() => () => {
    document.title = "Kanisha Enterprises — Quality Seeds, Fertilizers & Farm Inputs";
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <ErrorState message={error || "Article not found"} onRetry={load} />
        <div className="mt-6 text-center">
          <Link to="/blog" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Back to the blog
          </Link>
        </div>
      </div>
    );
  }

  const date = new Date(post.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Rough reading time from the word count.
  const words = (post.content || "").split(/\s+/).length;
  const readTime = Math.max(1, Math.round(words / 220));

  return (
    <article className="bg-sand-50 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-semibold text-sand-500 transition hover:text-brand-700"
        >
          <ArrowLeft size={16} />
          All articles
        </Link>

        {/* Header */}
        <header className="mt-6">
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold capitalize text-brand-700 transition hover:bg-brand-100"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mt-4 font-display text-3xl font-bold leading-tight text-sand-900 sm:text-4xl"
          >
            {post.title}
          </motion.h1>

          <p className="mt-4 text-lg leading-relaxed text-sand-600">{post.excerpt}</p>

          <div className="mt-6 flex flex-wrap items-center gap-5 border-b border-sand-200 pb-6 text-sm text-sand-500">
            <span className="flex items-center gap-2">
              <UserRound size={15} />
              {post.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar size={15} />
              {date}
            </span>
            <span className="flex items-center gap-2">
              <BookOpen size={15} />
              {readTime} min read
            </span>

            <button
              onClick={copyLink}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-sand-500 transition hover:bg-sand-200 hover:text-sand-800"
            >
              {copied ? (
                <>
                  <Check size={15} className="text-brand-600" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 size={15} />
                  Share
                </>
              )}
            </button>
          </div>
        </header>

        {/* Cover */}
        {post.coverImage && !coverFailed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-8 overflow-hidden rounded-3xl"
          >
            <img
              src={post.coverImage}
              alt=""
              onError={() => setCoverFailed(true)}
              className="aspect-[16/9] w-full object-cover"
            />
          </motion.div>
        )}

        {/* Body — plain paragraphs split on blank lines */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="mt-10 space-y-5 text-[17px] leading-[1.85] text-sand-700"
        >
          {(post.content || "").split(/\n\s*\n/).map((paragraph, i) => {
            const text = paragraph.trim();
            if (!text) return null;

            // A short, all-caps line is treated as a subheading.
            const isHeading =
              text.length < 70 &&
              text === text.toUpperCase() &&
              /[A-Z]{3}/.test(text);

            if (isHeading) {
              return (
                <h2
                  key={i}
                  className="pt-4 font-display text-xl font-bold text-sand-900"
                >
                  {text}
                </h2>
              );
            }

            return <p key={i}>{text}</p>;
          })}
        </motion.div>

        {/* Share helper */}
        <div className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-5 ring-1 ring-sand-200">
          <p className="flex-1 text-sm text-sand-600">
            Found this useful? Share it with another grower.
          </p>
          <button
            onClick={copyLink}
            className="btn-shine flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-sand-900">
              Read next
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r._id}
                  to={`/blog/${r.slug}`}
                  className="card card-hover group p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                    {r.tags?.[0] || "Article"}
                  </p>
                  <h3 className="mt-2 line-clamp-3 font-bold leading-snug text-sand-900 transition-colors group-hover:text-brand-700">
                    {r.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
