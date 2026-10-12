const express = require("express");
const { createKPI,getManagedUsers,getKPIsByRole } = require("../../controllers/kpi.controller");
const { cacheMiddleware } = require("../../middlewares/redisCache");
const router = express.Router();

// Tạo KPI
router.post("/kpi", createKPI);
router.get("/managed", cacheMiddleware(180), getManagedUsers);
router.get("/kpis", cacheMiddleware(180), getKPIsByRole);
module.exports = router;
