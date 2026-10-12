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

exports.getLeads = async (req, res) => {
  try {
    const leads = await AffiliateLead.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
