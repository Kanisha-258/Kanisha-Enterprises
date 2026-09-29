import { useState } from "react";
import { Leaf } from "lucide-react";

/**
 * Product image with a designed fallback.
 *
 * The seed data references product photos that may not have been added yet,
 * so instead of showing a broken image icon we render an on-brand gradient
 * panel with the product's initials. Looks intentional either way.
 */
export default function ProductImage({
  src,
  alt = "",
  name = "",
  className = "",
  sizes = "",
  loading = "lazy",
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  // Deterministic hue per product so each card's fallback is its own colour.
  const hue = [...String(name || src || "x")].reduce(
    (acc, char) => (acc + char.charCodeAt(0)) % 360,
    0
  );

  if (!src || failed) {
    // Each product gets a slightly different tint, so a grid of missing
    // photos looks varied rather than like one repeated placeholder.
    const from = `hsl(${hue} 45% 92%)`;
    const to = `hsl(${(hue + 40) % 360} 42% 84%)`;
    const ink = `hsl(${hue} 40% 32%)`;

    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        aria-label={alt || name}
        role={alt ? "img" : undefined}
      >
        <div className="flex flex-col items-center gap-2" style={{ color: ink }}>
          <Leaf size={30} strokeWidth={1.5} />
          {name && (
            <span className="max-w-[80%] truncate px-2 text-center text-xs font-semibold uppercase tracking-wide">
              {name}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || name}
      sizes={sizes}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}
