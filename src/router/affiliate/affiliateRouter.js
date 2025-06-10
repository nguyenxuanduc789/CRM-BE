const express = require("express");
const router = express.Router();
const { createAffiliateReport ,getAffiliateReportSummary,updateAffiliateReportByIp,getAffiliateReportsOfUser} = require("../../controllers/affiliateReport.controller");

const { registerAffiliate, loginAffiliate, recordClick, getClicks } = require('../../controllers/affilite.controller');
const rateLimit = require('express-rate-limit');
const clickLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 5, // Tối đa 5 click/phút từ một IP
  message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau!',
});



router.post("/create", createAffiliateReport);
router.post('/affiliate-report/update-by-ip', updateAffiliateReportByIp);
router.get('/affiliate-report/user/:userId', getAffiliateReportsOfUser);
router.get("/reports/summary/:userId", getAffiliateReportSummary);
router.post('/register', registerAffiliate);
router.post('/login', loginAffiliate);
router.post('/click', clickLimiter, recordClick);
router.get('/clicks', getClicks);
module.exports = router;