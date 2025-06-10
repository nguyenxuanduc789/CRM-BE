const Voucher = require("../models/voucher.model");

const applyVoucher = async (req, res) => {
  const { voucherCode } = req.body;

  try {
    const voucher = await Voucher.findOne({ voucher_code: voucherCode });

    if (voucher) {
      return res
        .status(200)
        .json({ valid: true, discountPercent: voucher.discount_percent });
    } else {
      return res
        .status(400)
        .json({ valid: false, message: "Voucher không hợp lệ" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Có lỗi server xảy ra", error });
  }
};

module.exports = { applyVoucher };
