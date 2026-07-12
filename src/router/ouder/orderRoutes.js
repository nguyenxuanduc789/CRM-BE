const express = require("express");
const router = express.Router();
const {
  createOrder,
  Update,
  cassoWebhook,
  simpleCassoWebhook,
} = require("../../controllers/PipelineController.controler");

router.post("/create-order", createOrder); // Loại bỏ authenticateUser

router.post("/hooks/sepay-payment", Update);

router.post("/hooks/casso-payment", cassoWebhook);

router.post("/hooks/casso-test", simpleCassoWebhook);

module.exports = router;
