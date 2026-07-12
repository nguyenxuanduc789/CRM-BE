const express = require("express");
const cookieParser = require('cookie-parser');
const cors = require('cors');
const requestIp = require('request-ip');
const { apiKey, permission } = require("../auth/checkAuth");
const router = express.Router();
const authenticate = require("../middlewares/authorize");

// Middleware toàn cục
router.use(express.json());
router.use(cookieParser());
router.use(cors({ origin: '*', credentials: true }));
router.use(requestIp.mw()); // Middleware để lấy IP thực

// Routes
const adminRoutes = require("./admin/adminRoutes");
const contactRoutes = require("./contact/contactRoutes");
const productRoutes = require("./product/productRoutes");
const timekeepingRoutes = require("./timekeeping/timekeepingRoutes");
const pinelineRouter = require("./pineline/pinelineRouter");
const voucherRouter = require("./voucher/voucherRouter");
const workStreamRouter = require("./workstream/workstreamRoutes");
const affiliateRouter = require("./affiliate/affiliateRouter");
const orderRouter = require("./ouder/orderRoutes");
const kpiRouter = require("./KPI/KPIRouter");
const PortalRouter = require("./portal/portalRouter");
const EliteMaster = require("./eliteMaste/eliteMasterRouter");
const EmailRouter = require("./emailRoutes/emailRoutes");
const LMSRouter = require("./lms");
router.use("/api/v1/contact", contactRoutes);
router.use("/api/v1/order", orderRouter);
router.use("/api/v1/admin", adminRoutes);
router.use("/api/v1/chamcong", timekeepingRoutes);
router.use("/api/v1/products", productRoutes);
router.use("/api/v1/pineline", pinelineRouter);
router.use("/api/v1/workstream", workStreamRouter);
router.use("/api/v1/aff", affiliateRouter);
router.use("/api/v1/voucher", voucherRouter);
router.use("/api/v1/kpi", kpiRouter);
router.use("/api/v1/portal", PortalRouter);

router.use("/api/v1/elite-mastermind", EliteMaster); 
router.use("/api/v1/emailmaketing", EmailRouter);       
router.use("/api/v1", require("./user"));
router.use("/api/v1", require("./auth"));

// LMS Routes (Learning Management System)
router.use("/api/lms", LMSRouter);

// Xử lý lỗi tổng quát
// router.use((err, req, res, next) => {
//   console.error('Server Error:', err);
//   res.status(500).json({ message: 'Lỗi server', error: err.message });
// });

module.exports = router;