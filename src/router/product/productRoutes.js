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

const { cacheMiddleware } = require("../../middlewares/redisCache");

// Route với middleware xác thực
router.get("/categoryproducts", cacheMiddleware(300), findProductsByCategoryAndName);
// Đổi từ POST sang GET và sử dụng params
router.get("/getallproducts/:user_id", cacheMiddleware(300), getAllProducts);
router.post('/:productId/vouchers',addVoucherToProduct);
router.post('/create', createProduct);
module.exports = router;
