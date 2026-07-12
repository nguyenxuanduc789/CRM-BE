// src/router/portal/portalRouter.js
const express = require('express');
const router = express.Router();
const portalController = require('../../controllers/portal.controller');
const contactPortalController = require('../../controllers/contactPortal.controller');

// Route lấy danh sách HubPortal và Pipeline_Portal
router.get('/portals-by-contact-date', portalController.getPortalsByContactDate);

// Lấy danh sách KH Contact Portal đã mua sản phẩm: thiền, yoga, coach, khoa học luân xa
router.get('/contacts-by-product-type', contactPortalController.getContactsByProductType);

module.exports = router;