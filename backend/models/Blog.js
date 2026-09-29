const mongoose = require("mongoose");

/** Turns "Kharif Season: A Guide" into "kharif-season-a-guide". */
const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // URL-friendly identifier, e.g. "kharif-season-complete-guide"
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    excerpt: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    coverImage: {
      type: String,
      default: "",
    },

    author: {
      type: String,
      default: "Kanisha Enterprises",
    },

    tags: {
      type: [String],
      default: [],
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Derives the URL slug from the title, and keeps it unique.
 *
 * Mirrors the approach Product already uses, so a post is always reachable at
 * /blog/<slug> even when the client sends no slug at all — the schema requires
 * one, and createBlog used to drop it, which made every create fail with
 * "Path `slug` is required".
 *
 * A numeric suffix is added until the slug is free, so two posts with the same
 * title both get created instead of the second one hitting a duplicate-key
 * error. This runs on create and on document .save(); it does not affect
 * findByIdAndUpdate, so editing a post never changes its existing URL.
 */
blogSchema.pre("validate", async function () {
  if (this.slug || !this.title) return; // explicitly supplied — respect it

  // Titles written in a script with no ASCII characters slugify to nothing,
  // so fall back to a random identifier rather than failing validation.
  const base = slugify(this.title) || `post-${Date.now().toString(36)}`;

  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-await-in-loop
  while (await mongoose.models.Blog.exists({ slug: candidate })) {
    candidate = `${base}-${++suffix}`;
  }

  this.slug = candidate;
});

module.exports = mongoose.model("Blog", blogSchema);