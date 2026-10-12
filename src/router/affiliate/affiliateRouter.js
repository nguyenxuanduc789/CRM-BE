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


const { cacheMiddleware } = require('../../middlewares/redisCache');

router.get('/affiliate/:affiliate_id', cacheMiddleware(180), getAffiliatePipelines);
router.post("/create", createAffiliateReport);
router.post('/affiliate-report/update-by-ip', updateAffiliateReportByIp);
router.get('/affiliate-report/user/:userId', cacheMiddleware(180), getAffiliateReportsOfUser);
router.get("/reports/summary/:userId", cacheMiddleware(180), getAffiliateReportSummary);
router.post('/register', registerAffiliate);
router.put('/report/:affiliate_id', updateAffiliateReport);
router.post('/login', loginAffiliate);
router.get('/by-affiliate/:affiliate_id', cacheMiddleware(180), getAffiliateReportById);
router.post('/click', clickLimiter, recordClick);
router.get('/clicks', cacheMiddleware(60), getClicks);
router.get('/:userId', cacheMiddleware(180), getAffiliateReportsByUser);
module.exports = router;