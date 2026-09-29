import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Heart,
  Check,
  Truck,
  ShieldCheck,
  Package,
  Info,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";

import { getProductById } from "../api/productApi";
import { createReview } from "../api/reviewApi";
import { sendEnquiry } from "../api/enquiryApi";
import useAuthStore from "../store/authStore";
import useCartStore, { selectIsWishlisted } from "../store/cartStore";
import ProductCard from "../components/ProductCard";
import ProductImage from "../components/ui/ProductImage";
import Rating from "../components/ui/Rating";
import QuantityStepper from "../components/ui/QuantityStepper";
import { Spinner, ErrorState } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import CTASection from "../components/CTASection";
import Reveal from "../components/ui/Reveal";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [tab, setTab] = useState("description");

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useCartStore((s) => s.toggleWishlist);
  const isWishlisted = useCartStore(selectIsWishlisted(product?._id));

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getProductById(slug);
      setProduct(data.product);
      setReviews(data.reviews || []);
      setRelated(data.related || []);
      setActiveImage(0);
      setQuantity(1);
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

  const handleAddToCart = () => {
    if (!product) return;

    if (product.stock <= 0) {
      toast.error("This product is out of stock.");
      return;
    }

    addItem(product, quantity);
    toast.success(`${product.name} added to your cart`);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    navigate("/checkout");
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.error("Please log in to write a review.");
      navigate("/login", { state: { from: { pathname: `/products/${slug}` } } });
      return;
    }

    setSubmittingReview(true);

    try {
      await createReview({
        productId: product._id,
        rating: reviewRating,
        comment: reviewComment,
      });

      const fresh = await getProductById(slug);
      setProduct(fresh.product);
      setReviews(fresh.reviews || []);
      setReviewComment("");

      toast.success("Thanks for your review!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Ask about this product. Collects real contact details so the shop can
  // actually reply — an earlier version posted placeholder data, which filled
  // the enquiry inbox with messages nobody could answer.
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiry, setEnquiry] = useState({ name: "", email: "", phone: "", message: "" });
  const [enquiryError, setEnquiryError] = useState("");
  const [enquirySending, setEnquirySending] = useState(false);

  const openEnquiry = () => {
    setEnquiryError("");
    setEnquiry({
      // Prefill from the signed-in customer when we have one.
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      message: `I'd like to know more about ${product?.name || "this product"} — availability, bulk pricing and delivery.`,
    });
    setEnquiryOpen(true);
  };

  const handleEnquire = async (e) => {
    e.preventDefault();
    setEnquiryError("");

    if (!enquiry.name.trim()) {
      setEnquiryError("Please enter your name so we can reply.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(enquiry.email.trim())) {
      setEnquiryError("Please enter a valid email address.");
      return;
    }
    if (enquiry.message.trim().length < 10) {
      setEnquiryError("Please add a little more detail.");
      return;
    }

    setEnquirySending(true);

    try {
      await sendEnquiry({
        name: enquiry.name.trim(),
        email: enquiry.email.trim(),
        phone: enquiry.phone ? enquiry.phone.replace(/\D/g, "").slice(0, 10) : "",
        subject: `Enquiry about ${product.name}`,
        message: enquiry.message.trim(),
        productId: product._id,
      });

      setEnquiryOpen(false);
      toast.success("Enquiry sent — we'll get back to you shortly.");
    } catch (err) {
      setEnquiryError(err.message);
    } finally {
      setEnquirySending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner size={32} className="text-brand-500" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <ErrorState message={error || "Product not found"} onRetry={load} />
        <div className="mt-6 text-center">
          <Link
            to="/products"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            ← Back to all products
          </Link>
        </div>
      </div>
    );
  }

  const hasDiscount =
    product.discountPrice > 0 && product.discountPrice < product.price;
  const price = hasDiscount ? product.discountPrice : product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;
  const outOfStock = product.stock <= 0;

  const gallery = [product.image, ...(product.gallery || [])];

  return (
    <>
      <section className="bg-sand-50 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-sand-500">
            <Link to="/" className="transition hover:text-brand-700">
              Home
            </Link>
            <ChevronRight size={14} className="text-sand-300" />
            <Link to="/products" className="transition hover:text-brand-700">
              Products
            </Link>
            <ChevronRight size={14} className="text-sand-300" />
            <Link
              to={`/products?category=${encodeURIComponent(product.category)}`}
              className="transition hover:text-brand-700"
            >
              {product.category}
            </Link>
            <ChevronRight size={14} className="text-sand-300" />
            <span className="font-medium text-sand-700">{product.name}</span>
          </nav>

          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            {/* Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className="card overflow-hidden">
                <div className="relative aspect-square bg-sand-100">
                  <ProductImage
                    key={activeImage}
                    src={gallery[activeImage]}
                    alt={product.name}
                    name={product.name}
                    className="h-full w-full object-cover"
                  />

                  {discountPercent > 0 && (
                    <span className="absolute left-4 top-4 rounded-full bg-clay-600 px-3 py-1.5 text-sm font-bold text-white shadow-lg">
                      {discountPercent}% OFF
                    </span>
                  )}

                  {outOfStock && (
                    <span className="absolute inset-x-0 bottom-0 bg-sand-900/85 py-3 text-center text-sm font-bold uppercase tracking-wider text-white">
                      Out of stock
                    </span>
                  )}
                </div>

                {gallery.length > 1 && (
                  <div className="flex gap-3 border-t border-sand-200 p-4">
                    {gallery.map((image, i) => (
                      <button
                        key={image + i}
                        onClick={() => setActiveImage(i)}
                        className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                          i === activeImage
                            ? "border-brand-600"
                            : "border-transparent hover:border-sand-300"
                        }`}
                        aria-label={`View image ${i + 1}`}
                      >
                        <ProductImage
                          src={image}
                          alt=""
                          name=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                {product.subcategory || product.category}
              </p>

              <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-sand-900 sm:text-4xl">
                {product.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                {product.numReviews > 0 ? (
                  <button
                    onClick={() => {
                      setTab("reviews");
                      document
                        .getElementById("reviews")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="transition hover:opacity-80"
                  >
                    <Rating value={product.rating} count={product.numReviews} size={17} />
                  </button>
                ) : (
                  <span className="text-sm text-sand-400">No reviews yet</span>
                )}

                {product.sku && (
                  <span className="text-xs text-sand-400">SKU: {product.sku}</span>
                )}
              </div>

              {/* Price */}
              <div className="mt-7 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-4xl font-bold text-sand-900">
                  ₹{price.toLocaleString("en-IN")}
                </span>

                {hasDiscount && (
                  <>
                    <span className="text-lg text-sand-400 line-through">
                      ₹{product.price.toLocaleString("en-IN")}
                    </span>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                      You save ₹{(product.price - product.discountPrice).toLocaleString("en-IN")}
                    </span>
                  </>
                )}
              </div>

              {product.unit && (
                <p className="mt-1.5 text-sm text-sand-500">Sold per {product.unit}</p>
              )}

              <p className="mt-6 leading-relaxed text-sand-600">
                {product.description}
              </p>

              {/* Stock */}
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${
                    outOfStock
                      ? "bg-red-50 text-red-700"
                      : product.stock <= 5
                        ? "bg-wheat-50 text-wheat-700"
                        : "bg-brand-50 text-brand-700"
                  }`}
                >
                  <Package size={15} />
                  {outOfStock
                    ? "Out of stock"
                    : product.stock <= 5
                      ? `Only ${product.stock} left`
                      : `${product.stock} in stock`}
                </span>
              </div>

              {/* Buy box */}
              <div className="mt-7 rounded-2xl border border-sand-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <QuantityStepper
                    value={quantity}
                    max={product.stock || 1}
                    disabled={outOfStock}
                    onChange={setQuantity}
                  />

                  <p className="text-sm text-sand-500">
                    Total:{" "}
                    <span className="font-bold text-sand-900">
                      ₹{(price * quantity).toLocaleString("en-IN")}
                    </span>
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleAddToCart}
                    disabled={outOfStock}
                    className={`btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition-all duration-300 ${
                      outOfStock
                        ? "cursor-not-allowed bg-sand-200 text-sand-500"
                        : "bg-brand-700 text-white hover:bg-brand-800 hover:shadow-glow"
                    }`}
                  >
                    <ShoppingCart size={19} />
                    {outOfStock ? "Unavailable" : "Add to cart"}
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={outOfStock}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition ${
                      outOfStock
                        ? "cursor-not-allowed bg-sand-200 text-sand-500"
                        : "bg-wheat-400 text-wheat-900 hover:bg-wheat-300"
                    }`}
                  >
                    Buy now
                  </button>

                  <button
                    onClick={() => {
                      toggleWishlist(product);
                      toast.info(
                        isWishlisted
                          ? "Removed from wishlist"
                          : "Saved to wishlist"
                      );
                    }}
                    className="grid w-full place-items-center rounded-xl border border-sand-200 px-5 py-3.5 transition hover:border-clay-300 hover:bg-clay-50 sm:w-auto"
                    aria-label="Toggle wishlist"
                  >
                    <Heart
                      size={19}
                      className={
                        isWishlisted ? "fill-clay-500 text-clay-500" : "text-sand-500"
                      }
                    />
                  </button>
                </div>

                <div className="mt-5 space-y-2.5 border-t border-sand-100 pt-5 text-sm">
                  <p className="flex items-center gap-2.5 text-sand-600">
                    <Truck size={16} className="shrink-0 text-brand-600" />
                    Delivery across town, dispatch further out
                  </p>
                  <p className="flex items-center gap-2.5 text-sand-600">
                    <ShieldCheck size={16} className="shrink-0 text-brand-600" />
                    Quality checked before dispatch
                  </p>
                  <button
                    onClick={openEnquiry}
                    className="flex items-center gap-2.5 text-brand-700 transition hover:text-brand-800"
                  >
                    <MessageCircle size={16} className="shrink-0" />
                    Ask about bulk pricing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="mt-16" id="reviews">
            <div className="flex gap-1 overflow-x-auto border-b border-sand-200">
              {[
                { id: "description", label: "Description" },
                { id: "usage", label: "How to use" },
                { id: "specs", label: "Specifications" },
                { id: "reviews", label: `Reviews (${reviews.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative shrink-0 px-5 py-3.5 text-sm font-semibold transition-colors ${
                    tab === t.id ? "text-brand-700" : "text-sand-500 hover:text-sand-700"
                  }`}
                >
                  {t.label}
                  {tab === t.id && (
                    <motion.span
                      layoutId="tab-underline"
                      className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="py-8">
              {tab === "description" && (
                <div className="max-w-3xl">
                  <p className="whitespace-pre-line leading-relaxed text-sand-600">
                    {product.details || product.description}
                  </p>

                  {product.highlights?.length > 0 && (
                    <>
                      <h2 className="mt-8 font-display text-lg font-bold text-sand-900">
                        Highlights
                      </h2>
                      <ul className="mt-4 space-y-2.5">
                        {product.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-2.5 text-sand-600">
                            <Check
                              size={17}
                              className="mt-0.5 shrink-0 text-brand-600"
                            />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {tab === "usage" && (
                <div className="max-w-3xl">
                  <p className="whitespace-pre-line leading-relaxed text-sand-600">
                    {product.usage ||
                      "Usage instructions are printed on the pack. Ask our team if you need help for your specific crop."}
                  </p>

                  <div className="mt-6 flex gap-3 rounded-2xl border border-wheat-200 bg-wheat-50 p-4">
                    <Info size={19} className="mt-0.5 shrink-0 text-wheat-600" />
                    <p className="text-sm text-wheat-800">
                      Always follow the label on the pack, and wear protective
                      equipment when handling crop-protection products.
                    </p>
                  </div>
                </div>
              )}

              {tab === "specs" && (
                <dl className="grid max-w-2xl gap-px overflow-hidden rounded-2xl border border-sand-200 bg-sand-200 sm:grid-cols-2">
                  {[
                    ["Category", product.category],
                    ["Subcategory", product.subcategory],
                    ["Brand", product.brand],
                    ["Pack size", product.unit],
                    ["SKU", product.sku],
                    ["Availability", outOfStock ? "Out of stock" : `${product.stock} in stock`],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label} className="bg-white px-5 py-4">
                        <dt className="text-xs font-bold uppercase tracking-wider text-sand-400">
                          {label}
                        </dt>
                        <dd className="mt-1 font-medium text-sand-800">{value}</dd>
                      </div>
                    ))}
                </dl>
              )}

              {tab === "reviews" && (
                <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
                  <div>
                    {reviews.length === 0 ? (
                      <p className="py-8 text-sand-500">
                        No reviews yet. If you've bought this, yours would be the first.
                      </p>
                    ) : (
                      <ul className="space-y-5">
                        {reviews.map((review) => (
                          <li key={review._id} className="card p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                                  {(review.user?.name || review.userName || "?")[0]}
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-sand-900">
                                    {review.user?.name || review.userName}
                                  </p>
                                  <p className="text-xs text-sand-400">
                                    {new Date(review.createdAt).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                </div>
                              </div>

                              <Rating value={review.rating} size={14} />
                            </div>

                            {review.comment && (
                              <p className="mt-4 text-sm leading-relaxed text-sand-600">
                                {review.comment}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Write a review */}
                  <form onSubmit={handleSubmitReview} className="card h-fit p-6">
                    <h3 className="font-display text-lg font-bold text-sand-900">
                      Write a review
                    </h3>
                    <p className="mt-1 text-sm text-sand-500">
                      Only customers with a delivered order can review.
                    </p>

                    <div className="mt-5">
                      <label className="text-sm font-semibold text-sand-700">
                        Your rating
                      </label>
                      <div className="mt-2">
                        <Rating
                          value={reviewRating}
                          interactive
                          size={16}
                          onChange={setReviewRating}
                        />
                      </div>
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor="review-comment"
                        className="text-sm font-semibold text-sand-700"
                      >
                        Your experience
                      </label>
                      <textarea
                        id="review-comment"
                        rows={4}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="How did it perform in the field?"
                        className="mt-2 w-full resize-none rounded-xl border border-sand-200 px-4 py-3 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="btn-shine mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                    >
                      {submittingReview && <Spinner size={16} />}
                      {submittingReview ? "Submitting…" : "Submit review"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <Reveal className="mt-20">
              <h2 className="font-display text-2xl font-bold text-sand-900">
                You might also like
              </h2>

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((p, i) => (
                  <ProductCard key={p._id} product={p} index={i} />
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <CTASection />

      {/* Ask about this product */}
      <AnimatePresence>
        {enquiryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEnquiryOpen(false)}
              className="fixed inset-0 z-[95] bg-sand-950/50 backdrop-blur-sm"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Enquire about ${product.name}`}
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.25 }}
              className="fixed left-1/2 top-1/2 z-[96] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-sand-900">
                    Ask about this product
                  </h2>
                  <p className="mt-1 line-clamp-1 text-sm text-sand-500">
                    {product.name}
                  </p>
                </div>

                <button
                  onClick={() => setEnquiryOpen(false)}
                  className="rounded-xl p-2 text-sand-500 transition hover:bg-sand-100"
                  aria-label="Close"
                >
                  <X size={19} />
                </button>
              </div>

              <form onSubmit={handleEnquire} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Your name *
                    </label>
                    <input
                      required
                      value={enquiry.name}
                      onChange={(e) =>
                        setEnquiry((p) => ({ ...p, name: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-sand-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-sand-700">
                      Mobile number
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={enquiry.phone}
                      onChange={(e) =>
                        setEnquiry((p) => ({
                          ...p,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-sand-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Email address *
                  </label>
                  <input
                    type="email"
                    required
                    value={enquiry.email}
                    onChange={(e) =>
                      setEnquiry((p) => ({ ...p, email: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-sand-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-sand-700">
                    Your message *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={enquiry.message}
                    onChange={(e) =>
                      setEnquiry((p) => ({ ...p, message: e.target.value }))
                    }
                    className="mt-1.5 w-full resize-none rounded-xl border border-sand-200 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>

                {enquiryError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {enquiryError}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setEnquiryOpen(false)}
                    className="rounded-xl border border-sand-200 px-5 py-3 text-sm font-semibold text-sand-600 transition hover:bg-sand-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={enquirySending}
                    className="btn-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                  >
                    {enquirySending ? (
                      <Spinner size={16} />
                    ) : (
                      <MessageCircle size={17} />
                    )}
                    {enquirySending ? "Sending…" : "Send enquiry"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
