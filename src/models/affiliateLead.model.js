const mongoose = require('mongoose');

const affiliateLeadSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    affiliateCode: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AffiliateLead', affiliateLeadSchema);
