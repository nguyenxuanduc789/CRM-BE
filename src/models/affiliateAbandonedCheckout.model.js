const mongoose = require("mongoose");

const affiliateAbandonedCheckoutSchema = new mongoose.Schema(
  {
    intentId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    phone: { type: String, default: "" },
    affiliateCode: { type: String, default: "", index: true },
    affiliateName: { type: String, default: "" },
    productCode: { type: String, default: "" },
    intentCreatedAt: { type: Date, default: Date.now },
    task: { type: String, default: "call_back_24h" },
    status: { type: String, default: "pending" }, // pending, contacted, converted, cancelled
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AffiliateAbandonedCheckout",
  affiliateAbandonedCheckoutSchema
);
