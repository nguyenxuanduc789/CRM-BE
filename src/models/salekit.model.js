// models/saleKit.js
const mongoose = require('mongoose');

const saleKitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  file: { type: String, required: true },
}, { timestamps: true });

const SaleKit = mongoose.model('SaleKit', saleKitSchema);

module.exports = SaleKit;
