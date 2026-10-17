// src/router/portal/portalRouter.js
const express = require('express');
const router = express.Router();
const portalController = require('../../controllers/portal.controller');
const contactPortalController = require('../../controllers/contactPortal.controller');

const { cacheMiddleware } = require('../../middlewares/redisCache');

const ExportController = require('../../controllers/export.controller');

// Route lấy danh sách HubPortal và Pipeline_Portal
router.get('/portals-by-contact-date', cacheMiddleware(180), portalController.getPortalsByContactDate);

// Cập nhật trạng thái portal (Pending / Enrolled / Done)
router.patch('/portal-status', portalController.updatePortalStatus);

// Lấy danh sách KH Contact Portal đã mua sản phẩm: thiền, yoga, coach, khoa học luân xa
router.get('/contacts-by-product-type', cacheMiddleware(300), contactPortalController.getContactsByProductType);

// Xuất file Excel học viên 200H trong Tab Pipeline Portal
router.get('/export-200h', ExportController.exportPipelinePortal200h);

module.exports = router;