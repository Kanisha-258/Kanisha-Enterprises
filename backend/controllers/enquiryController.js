const Enquiry = require("../models/Enquiry");
const Product = require("../models/Product");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const { isEmail, isNonEmptyString, toPage, toLimit } = require("../utils/validators");

// POST /api/enquiries — public contact form
const createEnquiry = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message, productId } = req.body;

  if (!isNonEmptyString(name)) throw new AppError("Please enter your name", 400);
  if (!isEmail(email)) throw new AppError("Please enter a valid email address", 400);
  if (!isNonEmptyString(message)) throw new AppError("Please enter a message", 400);
  if (String(message).trim().length < 10) {
    throw new AppError("Please add a little more detail to your message", 400);
  }

  // Reject junk submissions without bothering the database.
  const honeypot = req.body.website;
  if (honeypot) {
    return res.status(201).json({ success: true, message: "Enquiry received" });
  }

  // Optional link to a product, so the shop knows what was being asked about.
  let product = null;
  if (productId) {
    const found = await Product.findById(productId).select("_id");
    product = found ? found._id : null;
  }

  const enquiry = await Enquiry.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? String(phone).trim() : "",
    subject: subject || "General enquiry",
    message: message.trim(),
    product,
  });

  res.status(201).json({
    success: true,
    message: "Thank you! We'll get back to you shortly.",
    enquiry: { _id: enquiry._id },
  });
});

// --- Admin ---

// GET /api/enquiries/admin/all   (protected + admin)
const getEnquiries = asyncHandler(async (req, res) => {
  const page = toPage(req.query.page);
  const limit = toLimit(req.query.limit, 20, 100);

  const filter = {};
  if (req.query.status && req.query.status !== "all") {
    filter.status = req.query.status;
  }

  const [enquiries, total, unread] = await Promise.all([
    Enquiry.find(filter)
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Enquiry.countDocuments(filter),
    Enquiry.countDocuments({ status: "new" }),
  ]);

  res.json({
    success: true,
    count: enquiries.length,
    total,
    unread,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    enquiries,
  });
});

// PUT /api/enquiries/admin/:id/status   (protected + admin)
const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["new", "read", "replied", "archived"].includes(status)) {
    throw new AppError("Invalid enquiry status", 400);
  }

  const enquiry = await Enquiry.findByIdAndUpdate(
    req.params.id,
    { status },
    { returnDocument: "after" }
  );

  if (!enquiry) throw new AppError("Enquiry not found", 404);

  res.json({ success: true, message: "Enquiry updated", enquiry });
});

// DELETE /api/enquiries/admin/:id   (protected + admin)
const deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) throw new AppError("Enquiry not found", 404);

  res.json({ success: true, message: "Enquiry deleted" });
});

module.exports = {
  createEnquiry,
  getEnquiries,
  updateEnquiryStatus,
  deleteEnquiry,
};
