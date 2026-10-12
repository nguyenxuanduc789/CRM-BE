const mongoose = require('mongoose');

const affiliateOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    productCode: { type: String, default: "" },
    orderAmount: { type: Number, default: 0 },
    orderCurrency: { type: String, default: "VND" },
    commissionAmount: { type: Number, default: 0 },
    affiliateCode: { type: String, default: "" },
    affiliateName: { type: String, default: "" },
    status: { type: String, default: "confirmed" },
    orderCreatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AffiliateOrder', affiliateOrderSchema);
