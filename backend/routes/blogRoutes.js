const express = require("express");

const {
  getBlogs,
  getBlogTags,
  getBlogBySlug,
  getAdminBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
} = require("../controllers/blogController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// Public — specific paths first so "/tags" isn't swallowed by "/:slug".
router.get("/", getBlogs);
router.get("/tags", getBlogTags);
router.get("/:slug", getBlogBySlug);

// Admin
router.get("/admin/all", authMiddleware, adminMiddleware, getAdminBlogs);
router.post("/", authMiddleware, adminMiddleware, createBlog);
router.put("/:id", authMiddleware, adminMiddleware, updateBlog);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBlog);

module.exports = router;
