const express = require("express");
const router = express.Router();
const { createEliteMastermind ,getEliteMasterminds} = require("../../controllers/eliteMastermind.controller");

router.post("/createmaster", createEliteMastermind);
router.get("/getmasters", getEliteMasterminds);

module.exports = router;