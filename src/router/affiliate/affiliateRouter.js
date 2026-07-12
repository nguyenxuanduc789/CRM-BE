const express = require("express");
const router = express.Router();
const {getAffiliatePipelines,getAffiliateReportById, createAffiliateReport ,getAffiliateReportsByUser,getAffiliateReportSummary,updateAffiliateReportByIp,getAffiliateReportsOfUser} = require("../../controllers/affiliateReport.controller");

const { registerAffiliate, updateAffiliateReport,loginAffiliate, recordClick, getClicks } = require('../../controllers/affilite.controller');
const rateLimit = require('express-rate-limit');
const clickLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 5, // Tối đa 5 click/phút từ một IP
  message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau!',
});


router.get('/affiliate/:affiliate_id', getAffiliatePipelines);
router.post("/create", createAffiliateReport);
router.post('/affiliate-report/update-by-ip', updateAffiliateReportByIp);
router.get('/affiliate-report/user/:userId', getAffiliateReportsOfUser);
router.get("/reports/summary/:userId", getAffiliateReportSummary);
router.post('/register', registerAffiliate);
router.put('/report/:affiliate_id', updateAffiliateReport);
router.post('/login', loginAffiliate);
router.get('/by-affiliate/:affiliate_id',getAffiliateReportById);
router.post('/click', clickLimiter, recordClick);
router.get('/clicks', getClicks);
router.get('/:userId', getAffiliateReportsByUser);
module.exports = router;