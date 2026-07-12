const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificate.controller');

// API Routes cho tra cứu chứng chỉ
router.post('/request-otp', certificateController.requestOtp);
router.post('/verify-otp', certificateController.verifyOtp);
router.post('/search', certificateController.searchCertificates);
router.get('/list', certificateController.getCertificates);
router.put('/:id/url', certificateController.updateCertificateUrl);

module.exports = router;
