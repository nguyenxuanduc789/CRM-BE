const express = require("express");
const { createKPI,getManagedUsers,getKPIsByRole } = require("../../controllers/kpi.controller");
const router = express.Router();

// Tạo KPI
router.post("/kpi", createKPI);
router.get("/managed", getManagedUsers);
router.get("/kpis", getKPIsByRole);
module.exports = router;
