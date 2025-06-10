const express = require("express");
const router = express.Router();
const voucherController = require("../../controllers/voucher.controller");

// Route áp dụng voucher
router.post("/apply", voucherController.applyVoucher);

module.exports = router;
