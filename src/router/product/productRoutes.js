const express = require("express");
const {
  findProductsByCategoryAndName,
  getAllProducts,
  addVoucherToProduct,
  createProduct,
} = require("../../controllers/product.conller");
const router = express.Router();
const mockAuth = require("../mockAuth");
const authorize = require("../../middlewares/authorize");

// Route với middleware xác thực
router.get("/categoryproducts", findProductsByCategoryAndName);
// Đổi từ POST sang GET và sử dụng params
router.get("/getallproducts/:user_id", getAllProducts);
router.post('/:productId/vouchers',addVoucherToProduct);
router.post('/create', createProduct);
module.exports = router;
