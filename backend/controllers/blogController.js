const Blog = require("../models/Blog");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const escapeRegex = require("../utils/escapeRegex");
const { isObjectId, toPage, toLimit } = require("../utils/validators");

// GET /api/blogs
// Query: ?tag=&search=&limit=&page=
const getBlogs = asyncHandler(async (req, res) => {
  const { tag, search } = req.query;
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 9, 50);

  const filter = { isPublished: true };

  if (tag) filter.tags = escapeRegex(tag);

  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
  }

  const [blogs, total] = await Promise.all([
    // Listing view doesn't need the full article body.
    Blog.find(filter)
      .select("-content")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Blog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: blogs.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    blogs,
  });
});

// GET /api/blogs/tags — for a tag cloud on the blog index
const getBlogTags = asyncHandler(async (req, res) => {
  const tags = await Blog.distinct("tags", { isPublished: true });
  res.json({ success: true, tags: tags.filter(Boolean).sort() });
});

// GET /api/blogs/:slug
const getBlogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const query = isObjectId(slug)
    ? { _id: slug, isPublished: true }
    : { slug: slug.toLowerCase(), isPublished: true };

  const blog = await Blog.findOne(query);

  if (!blog) throw new AppError("Blog post not found", 404);

  // "Read next" suggestions from the same tags.
  const related = await Blog.find({
    _id: { $ne: blog._id },
    isPublished: true,
    tags: { $in: blog.tags },
  })
    .select("-content")
    .sort({ createdAt: -1 })
    .limit(3);

  res.json({ success: true, blog, related });
});

// --- Admin ---

// GET /api/blogs/admin/all   (protected + admin) — includes drafts
const getAdminBlogs = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};
  if (req.query.search) {
    filter.title = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
  }

  const [blogs, total] = await Promise.all([
    // `content` is included here (unlike the public list above) because the
    // admin editor populates its form from these rows. Excluding it left the
    // body empty, and since it is a required field the form would not submit.
    Blog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Blog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: blogs.length,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    blogs,
  });
});

// POST /api/blogs   (protected + admin)
const createBlog = asyncHandler(async (req, res) => {
  const { title, excerpt, content, coverImage, slug, tags, isPublished, author } = req.body;

  if (!title || !excerpt || !content) {
    throw new AppError("Title, excerpt and content are all required", 400);
  }

  const blog = await Blog.create({
    title: title.trim(),
    // Only used when supplied; otherwise the model derives one from the title.
    // This was missing, so the required `slug` never reached the document and
    // every create failed with "Path `slug` is required".
    ...(slug ? { slug: slug.trim().toLowerCase() } : {}),
    excerpt,
    content,
    coverImage: coverImage || "",
    tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    isPublished: isPublished === undefined ? true : Boolean(isPublished),
    author: author || "Kanisha Enterprises",
  });

  res.status(201).json({ success: true, message: "Post created", blog });
});

// PUT /api/blogs/:id   (protected + admin)
const updateBlog = asyncHandler(async (req, res) => {
  const fields = ["title", "excerpt", "content", "coverImage", "tags", "isPublished", "author", "slug"];

  const updates = {};
  fields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  const blog = await Blog.findByIdAndUpdate(req.params.id, updates, {
    returnDocument: "after",
    runValidators: true,
  });

  if (!blog) throw new AppError("Blog post not found", 404);

  res.json({ success: true, message: "Post updated", blog });
});

// DELETE /api/blogs/:id   (protected + admin)
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findByIdAndDelete(req.params.id);
  if (!blog) throw new AppError("Blog post not found", 404);

  res.json({ success: true, message: "Post deleted" });
});

module.exports = {
  getBlogs,
  getBlogTags,
  getBlogBySlug,
  getAdminBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
};
