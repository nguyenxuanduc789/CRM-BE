const express = require("express");
const router = express.Router();
const RishikeshSubmissionController = require("../../controllers/rishikeshSubmission.controller");

// Route GET: Lấy danh sách submission
router.get("/", RishikeshSubmissionController.getSubmissions);

// Route POST: Tạo mới submission (webhook hoặc client post)
router.post("/", RishikeshSubmissionController.createSubmission);

module.exports = router;
