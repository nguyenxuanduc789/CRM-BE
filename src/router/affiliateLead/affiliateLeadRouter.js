const express = require("express");
const router = express.Router();
const {
  createLead,
  getLeads,
  getOrders,
  syncOrder,
  createAbandonedCheckout,
  getAbandonedCheckouts,
} = require("../../controllers/affiliateLead.controller");

const { cacheMiddleware } = require("../../middlewares/redisCache");
const verifyDacSuHmac = require("../../middlewares/verifyDacSuHmac");

// Nhận Lead từ Đắc Sư
router.post("/", createLead);
router.get("/", cacheMiddleware(60), getLeads);

// Nhận Đồng bộ đơn hàng từ Đắc Sư
router.post("/sync-order", syncOrder);
router.get("/orders", cacheMiddleware(60), getOrders);

// Nhận Giỏ hàng bỏ dở 24h từ Đắc Sư (Bắt buộc xác thực HMAC)
router.post("/abandoned-checkout", verifyDacSuHmac, createAbandonedCheckout);
router.get("/abandoned-checkouts", cacheMiddleware(60), getAbandonedCheckouts);

module.exports = router;
