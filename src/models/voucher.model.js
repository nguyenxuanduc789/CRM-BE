const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
  voucher_code: {
    type: String,
    required: true,
    unique: true,
  },
  discount_percent: {
    type: Number,
    required: true,
  },
});

const Voucher = mongoose.model("Voucher", voucherSchema);

module.exports = Voucher;
