const AffiliateLead = require("../models/affiliateLead.model");
const nodemailer = require("nodemailer");
const { clearCache } = require("../middlewares/redisCache");

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tech@khitamtherapy.com',
    pass: 'gHyK2h$xU3VL',
  },
});

exports.createLead = async (req, res) => {
  try {
    const { fullName, email, phone, affiliateCode, affiliateName } = req.body;
    const lead = await AffiliateLead.create({
      fullName,
      email,
      phone,
      affiliateCode,
      affiliateName: affiliateName || ""
    });

    // Clear cache để FE load ra ngay lập tức
    if (clearCache) {
      clearCache("affiliate-leads");
    }

    // Gửi email thông báo cho team Sale
    try {
      const mailOptions = {
        from: '"CRM System" <tech@khitamtherapy.com>',
        to: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, nguyenthithanhdiem2806@gmail.com',
        subject: '[CRM] CÓ KHÁCH HÀNG MỚI TỪ ĐẮC SƯ (AFFILIATE) - YÊU CẦU KIỂM TRA',
        html: `
          <h3>Xin chào team Sale,</h3>
          <p>Vừa có một khách hàng mới đăng ký qua kênh Đắc Sư (Affiliate).</p>
          <p>Vui lòng lên hệ thống CRM để kiểm tra thông tin chi tiết.</p>
          <br>
          <b>Thông tin khách hàng:</b>
          <ul>
            <li><b>Họ và tên:</b> ${fullName || 'Chưa cung cấp'}</li>
            <li><b>Số điện thoại:</b> ${phone || 'Chưa cung cấp'}</li>
            <li><b>Email:</b> ${email || 'Chưa cung cấp'}</li>
            <li><b>Mã CTV:</b> ${affiliateCode || 'Chưa cung cấp'}</li>
            <li><b>Tên CTV:</b> ${affiliateName || 'Chưa cung cấp'}</li>
          </ul>
          <br>
          <p>Cảm ơn,</p>
          <p>Hệ thống tự động CRM Khí Tâm</p>
        `
      };
      await transporter.sendMail(mailOptions);
      console.log("Sent notification email for new Affiliate lead to Sales team");
    } catch (mailErr) {
      console.error("Error sending affiliate lead email:", mailErr);
    }

    res.status(201).json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const AffiliateOrder = require("../models/affiliateOrder.model");

exports.getLeads = async (req, res) => {
  try {
    const leads = await AffiliateLead.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lưu / Đồng bộ đơn hàng từ Đắc Sư
exports.syncOrder = async (req, res) => {
  try {
    const {
      orderId,
      customerName,
      customerEmail,
      productCode,
      orderAmount,
      orderCurrency,
      commissionAmount,
      affiliateCode,
      affiliateName,
      status,
      orderCreatedAt,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const order = await AffiliateOrder.findOneAndUpdate(
      { orderId },
      {
        orderId,
        customerName: customerName || "",
        customerEmail: customerEmail || "",
        productCode: productCode || "",
        orderAmount: Number(orderAmount) || 0,
        orderCurrency: orderCurrency || "VND",
        commissionAmount: Number(commissionAmount) || 0,
        affiliateCode: affiliateCode || "",
        affiliateName: affiliateName || "",
        status: status || "confirmed",
        orderCreatedAt: orderCreatedAt ? new Date(orderCreatedAt) : new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (clearCache) {
      clearCache("affiliate-orders");
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách các đơn mua qua link Affiliate
exports.getOrders = async (req, res) => {
  try {
    const orders = await AffiliateOrder.find().sort({ orderCreatedAt: -1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
