const express = require("express");

const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  replaceCart,
  mergeCart,
} = require("../controllers/cartController");

const authMiddleware = require("../middleware/authMiddleware");
const { requestLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// A saved cart belongs to a person, so every endpoint here needs a session.
// Without this the routes would fall through to the public product endpoints,
// which expose no cart and no way to write one.
router.use(authMiddleware);

// Writes are rate limited, the same as placing an order: they mutate something
// the customer cares about, and none of them should be loopable.
const writeLimiter = requestLimiter({ windowMs: 60 * 1000, max: 60 });

// Declared before "/items/:productId" so "merge" is never read as a product id.
router.post("/merge", writeLimiter, mergeCart);

router.get("/", getCart);
router.post("/items", writeLimiter, addItem);
router.put("/items/:productId", writeLimiter, updateItem);
router.delete("/items/:productId", writeLimiter, removeItem);

// The full-basket sync the browser store uses. Declared after the per-item
// routes so "/items" is never swallowed by a bare "/" match.
router.put("/", writeLimiter, replaceCart);
router.delete("/", writeLimiter, clearCart);

module.exports = router;
