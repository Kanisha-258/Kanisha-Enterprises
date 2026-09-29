const express = require("express");

const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplierController");

const {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  receivePurchase,
  cancelPurchase,
  deletePurchase,
  getPurchaseSummary,
} = require("../controllers/purchaseController");

const {
  getInventory,
  getProductStockHistory,
  getRecentMovements,
  adjustStock,
  getInventorySummary,
} = require("../controllers/inventoryController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// Every route below requires a signed-in admin. There is no public or
// customer-facing path to suppliers, purchases or stock history.
router.use(authMiddleware, adminMiddleware);

/* ---------------------------- Suppliers ---------------------------- */

router.get("/suppliers", getSuppliers);
router.get("/suppliers/:id", getSupplierById);
router.post("/suppliers", createSupplier);
router.put("/suppliers/:id", updateSupplier);
router.delete("/suppliers/:id", deleteSupplier);

/* ---------------------------- Purchases ---------------------------- */

router.get("/purchases/summary", getPurchaseSummary);
router.get("/purchases", getPurchases);
router.get("/purchases/:id", getPurchaseById);
router.post("/purchases", createPurchase);
router.put("/purchases/:id", updatePurchase);
router.post("/purchases/:id/receive", receivePurchase);
router.put("/purchases/:id/cancel", cancelPurchase);
router.delete("/purchases/:id", deletePurchase);

/* ---------------------------- Inventory ---------------------------- */

// Product stock levels, with in/out history and average cost.
router.get("/inventory", getInventory);
router.get("/inventory/summary", getInventorySummary);
router.get("/inventory/movements", getRecentMovements);
router.get("/inventory/:productId", getProductStockHistory);

// Manual correction. Requires an explicit reason, enforced in the controller.
router.post("/inventory/:productId/adjust", adjustStock);

module.exports = router;
