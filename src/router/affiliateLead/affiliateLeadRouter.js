const express = require("express");
const router = express.Router();
const { createLead, getLeads } = require("../../controllers/affiliateLead.controller");

const { cacheMiddleware } = require("../../middlewares/redisCache");

router.post("/", createLead);
router.get("/", cacheMiddleware(60), getLeads);

module.exports = router;
