const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog.model');
const Contact = require('../models/contact.model');
const { htmlToText } = require('html-to-text');

// ======================
// TẠO TRANSPORTER TRỰC TIẾP TRONG CONTROLLER
// ======================
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: "tech@khitamtherapy.com",
    pass: "gHyK2h$xU3VL",           // Nên chuyển sang process.env sau này
  },
  tls: {
    rejectUnauthorized: false       // Tạm thời bỏ qua lỗi certificate nếu có
  }
});

// Kiểm tra transporter khi khởi động (chỉ chạy 1 lần)
transporter.verify((error) => {
  if (error) {
    console.error("❌ Transporter Error:", error.message);
  } else {
    console.log("✅ Office365 SMTP is ready to send emails");
  }
});

// ======================
// HÀM GỬI EMAIL
// ======================
const sendEmailToContact = async (req, res) => {
  try {
    const { 
      to,                    // Email người nhận (bắt buộc)
      name,                  // Tên người nhận (dùng để cá nhân hóa)
      profileCode,           // Mã hồ sơ (tùy chọn)
      subject, 
      html, 
      type = "custom", 
      cc = [],
      sentBy 
    } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!to || !subject) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin: to (email), subject, html" 
      });
    }

    // Kiểm tra email hợp lệ cơ bản
    if (!to.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        message: "Email người nhận không hợp lệ" 
      });
    }

    // Cá nhân hóa nội dung email
    let personalizedHtml = html
      .replace(/{{name}}/gi, name || "Quý khách")
      .replace(/{{profileCode}}/gi, profileCode || "")
      .replace(/{{email}}/gi, to);

    const textVersion = htmlToText(personalizedHtml, { wordwrap: 130 });

    let finalCc = ['nguyenthithanhdiem2806@gmail.com', 'khitamtherapytech@gmail.com'];
    if (Array.isArray(cc) && cc.length > 0) {
      finalCc.push(...cc);
    } else if (typeof cc === 'string') {
      finalCc.push(cc);
    }

    // Cấu hình email
    const mailOptions = {
      from: '"Khitam Therapy" <tech@khitamtherapy.com>',
      to: to,
      cc: finalCc,
      subject: subject.replace(/{{name}}/gi, name || ""),
      html: personalizedHtml,
      text: textVersion,
    };

    // Gửi email
    const info = await transporter.sendMail(mailOptions);

    // Lưu log (không cần liên kết với Contact model)
    const emailLog = new EmailLog({
      contact: null,                    // Không liên kết với Contact
      to: to,
      cc,
      subject: mailOptions.subject,
      html: personalizedHtml,
      text: textVersion,
      status: "sent",
      messageId: info.messageId,
      sentBy: sentBy || req.user?._id,
      type,
    });

    await emailLog.save();

    return res.status(200).json({
      success: true,
      message: "Gửi email thành công",
      messageId: info.messageId,
      logId: emailLog._id
    });

  } catch (error) {
    console.error("Send email error:", error);

    // Lưu log thất bại
    try {
      const failedLog = new EmailLog({
     
        to: req.body.to || "",
        subject: req.body.subject || "No Subject",
        html: req.body.html || "",
        status: "failed",
        errorMessage: error.message,
        sentBy: req.body.sentBy || req.user?._id,
        type: req.body.type || "other",
      });
      await failedLog.save();
    } catch (logError) {
      console.error("Lỗi khi lưu failed log:", logError);
    }

    return res.status(500).json({
      success: false,
      message: "Gửi email thất bại",
      error: error.message
    });
  }
};

module.exports = {
  sendEmailToContact
};

module.exports = {
  sendEmailToContact
};