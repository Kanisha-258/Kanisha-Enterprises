import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, ArrowRight } from "lucide-react";

import ProductImage from "./ui/ProductImage";
import Rating from "./ui/Rating";
import { useToast } from "./ui/Toast";
import useCartStore, { selectIsWishlisted } from "../store/cartStore";

const stockTone = (stock) => {
  if (stock <= 0) return "bg-red-50 text-red-700";
  if (stock <= 5) return "bg-wheat-50 text-wheat-700";
  return "bg-brand-50 text-brand-700";
};

const stockLabel = (stock) => {
  if (stock <= 0) return "Out of stock";
  if (stock <= 5) return `Only ${stock} left`;
  return "In stock";
};

export default function ProductCard({ product, index = 0 }) {
  const toast = useToast();

  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useCartStore((s) => s.toggleWishlist);
  const isWishlisted = useCartStore(selectIsWishlisted(product._id));

  const hasDiscount =
    product.discountPrice > 0 && product.discountPrice < product.price;

  const price = hasDiscount ? product.discountPrice : product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  const outOfStock = product.stock <= 0;
  const detailUrl = `/products/${product.slug || product._id}`;

  const handleAdd = (event) => {
    // The whole card is a link, so don't navigate when pressing add.
    event.preventDefault();
    event.stopPropagation();

    if (outOfStock) {
      toast.error("This product is out of stock right now.");
      return;
    }

    addItem(product, 1);
    toast.success(`${product.name} added to your cart`);
  };

  const handleWishlist = (event) => {
    event.preventDefault();
    event.stopPropagation();

    toggleWishlist(product);
    toast.info(
      isWishlisted
        ? `${product.name} removed from your wishlist`
        : `${product.name} saved to your wishlist`
    );
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.06, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="card card-hover group relative flex flex-col overflow-hidden"
    >
      <Link to={detailUrl} className="absolute inset-0 z-10" aria-label={product.name}>
        <span className="sr-only">View {product.name}</span>
      </Link>

      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-sand-100">
        <ProductImage
          src={product.image}
          alt={product.name}
          name={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {discountPercent > 0 && (
            <span className="rounded-full bg-clay-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              {discountPercent}% OFF
            </span>
          )}

          <span
            className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${stockTone(product.stock)}`}
          >
            {stockLabel(product.stock)}
          </span>
        </div>

        {/* Wishlist — sits above the card-wide link overlay */}
        <button
          onClick={handleWishlist}
          className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-md"
          aria-label={
            isWishlisted
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
        >
          <Heart
            size={17}
            className={
              isWishlisted
                ? "fill-clay-500 text-clay-500"
                : "text-sand-400 transition-colors hover:text-clay-500"
            }
          />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
          {product.subcategory || product.category}
        </p>

        <h3 className="mt-1.5 line-clamp-2 font-bold leading-snug text-sand-900 transition-colors group-hover:text-brand-700">
          {product.name}
        </h3>

        {product.unit && (
          <p className="mt-1 text-sm text-sand-500">{product.unit}</p>
        )}

        <div className="mt-2.5">
          {product.numReviews > 0 ? (
            <Rating value={product.rating} count={product.numReviews} />
          ) : (
            <span className="text-xs text-sand-400">No reviews yet</span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-sand-900">
              ₹{price.toLocaleString("en-IN")}
            </span>

            {hasDiscount && (
              <span className="text-sm text-sand-400 line-through">
                ₹{product.price.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-300 ${
              outOfStock
                ? "cursor-not-allowed bg-sand-200 text-sand-500"
                : "btn-shine bg-brand-700 text-white hover:bg-brand-800 hover:shadow-glow"
            }`}
          >
            <ShoppingCart size={17} />
            {outOfStock ? "Unavailable" : "Add to cart"}
          </button>
        </div>
      </div>

      {/* Hover hint — desktop only */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden translate-y-full items-center justify-center gap-1.5 bg-brand-800/95 py-2.5 text-sm font-semibold text-white transition-transform duration-300 group-hover:translate-y-0 lg:flex">
        View details <ArrowRight size={15} />
      </div>
    </motion.article>
  );
}
