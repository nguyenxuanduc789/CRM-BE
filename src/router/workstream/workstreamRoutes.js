const express = require("express");
const router = express.Router();

const { uploadWorkstream,addComment,getAllWorkstreams,likeWorkstream } = require("../../controllers/workstream.controler");

// Upload workstream với ảnh và user ID
router.post("/workstreams", uploadWorkstream);
router.get("/workstreams", getAllWorkstreams);
router.post('/workstreams/like', likeWorkstream);
router.post("/workstreams/comment", addComment);
module.exports = router;
