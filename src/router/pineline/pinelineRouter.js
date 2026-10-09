
const express = require("express");
const router = express.Router();
const ExportController = require("../../controllers/export.controller");
router.get("/export-200h-300h", ExportController.export200h300h);
router.get("/export-special", ExportController.exportSpecial);
const {
  createPipeline,
  getPipelinesrole,
  getPipelinesByCreator,
  getAllPipelines,
  updatePipelineStatus,
  addNoteToPipeline,
  editNote,
  deleteNote,
  deletePipeline,
  uploadImage,
  updatePipelineStage,
  getPipelinesroleaca,
  searchPipelinesByContact,
  searchPipelinesByProductName,
  updateInstallmentStatus,
  getPipelinesroles,
  getPipelinesByAff,
  getTeamPineline,
  updatePipeline,
} = require("../../controllers/pipelineController");

// Tạo một contact mới
router.post("/createpineline", createPipeline);
router.put("/installments/update-status/:id", updateInstallmentStatus);

router.get("/pipelineaff/:createdBy", getPipelinesByAff);
router.put("/:pipelineId/upload", uploadImage);
router.get("/pipelines/:createdBy", getPipelinesByCreator);
router.get("/getallpipelines/", getAllPipelines);
router.get("/teams/:userId/members", getTeamPineline);
router.put("/pipelines/:id/status", updatePipelineStatus);
router.get("/getpinelinerole", cacheMiddleware(300), getPipelinesrole);
router.get("/getpinelineroles", cacheMiddleware(300), getPipelinesroles);
router.get("/getpinelineroleaca", cacheMiddleware(300), getPipelinesroleaca);
router.post("/add-note", addNoteToPipeline);
router.put("/note/:noteId", editNote);
router.delete("/note/:noteId", deleteNote);
router.post("/search-pipeline", searchPipelinesByContact);
router.post("/search-product", searchPipelinesByProductName);
router.delete("/pineline/:id", deletePipeline);
router.put("/:id/update-stage", updatePipelineStage);
router.put("/pipelines/:id", updatePipeline);
module.exports = router;
