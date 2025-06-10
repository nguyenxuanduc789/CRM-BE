// models/AffiliateReport.js
const { model, Schema } = require('mongoose');

const affiliateReportSchema = new Schema(
  {
    affiliate_id: { type: String, required: true }, // Thay Number bằng String để khớp với affiliateId
    affiliate_name: { type: String, required: false, default: null },
    full_name: { type: String, required: false, default: null },
    email: { type: String, required: false, default: null },
    phone: { type: String, required: false, default: null },
    datetime: { type: Date, required: false, default: Date.now },
    ip: { type: String, required: false, default: null },
    user_agent: { type: String, required: false, default: null },
    hitid: { type: Number, required: false, default: null },
    deviceId: { type: String, required: false, default: null }, // Thêm deviceId để phân biệt thiết bị
    affiliateLink: { type: String, required: true }, // Link affiliate
  },
  {
    collection: 'wp_custom_affiliate_report',
    timestamps: false,
  }
);

module.exports = model('AffiliateReport', affiliateReportSchema);