const express = require("express");
const router = express.Router();
const {
  createLead,
  getLeads,
  getOrders,
  syncOrder,
} = require("../../controllers/affiliateLead.controller");

const { cacheMiddleware } = require("../../middlewares/redisCache");

router.post("/", createLead);
router.get("/", cacheMiddleware(60), getLeads);

router.post("/sync-order", syncOrder);
router.get("/orders", cacheMiddleware(60), getOrders);

module.exports = router;
