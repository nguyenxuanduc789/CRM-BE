const express = require("express");
const router = express.Router();
const { createLead, getLeads } = require("../../controllers/affiliateLead.controller");

router.post("/", createLead);
router.get("/", getLeads);

module.exports = router;
