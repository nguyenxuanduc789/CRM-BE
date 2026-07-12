
const express = require("express");
const router = express.Router();
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
router.get("/getpinelinerole", getPipelinesrole);
router.get("/getpinelineroles", getPipelinesroles);
router.get("/getpinelineroleaca", getPipelinesroleaca);
router.post("/add-note", addNoteToPipeline);
router.put("/note/:noteId", editNote);
router.delete("/note/:noteId", deleteNote);
router.post("/search-pipeline", searchPipelinesByContact);
router.post("/search-product", searchPipelinesByProductName);
router.delete("/pineline/:id", deletePipeline);
router.put("/:id/update-stage", updatePipelineStage);
router.put("/pipelines/:id", updatePipeline);
module.exports = router;
