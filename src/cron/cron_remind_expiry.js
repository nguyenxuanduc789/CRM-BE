const cron = require("node-cron");
const nodemailer = require("nodemailer");
const moment = require("moment");
const Pipeline = require("../models/pineline.model");
const EmailLog = require("../models/EmailLog.model");
const Contact = require("../models/contact.model");
const Product = require("../models/product.model");

// =====================
// TRANSPORTER
// =====================
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: "tech@khitamtherapy.com",
    pass: "gHyK2h$xU3VL",
  },
  tls: { rejectUnauthorized: false },
});

// =====================
// NỘI DUNG EMAIL
// =====================
const buildExpiryEmailHtml = (name, courseName, expiryDate, daysLeft) => {
  let timeText = "";
  if (daysLeft >= 28) timeText = "1 tháng";
  else if (daysLeft >= 9) timeText = "10 ngày";
  else timeText = "1 ngày";

  return `
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
  <p>Xin chào <strong>${name}</strong>,</p>

  <p>Học Viện Khí Tâm xin thông báo:</p>

  <p>Gói dịch vụ/khóa học <strong>${courseName}</strong> của bạn sẽ hết hạn vào ngày <strong>${expiryDate}</strong> (còn ${timeText} nữa).</p>
  
  <p>Để đảm bảo quá trình học tập và sử dụng dịch vụ không bị gián đoạn, bạn vui lòng liên hệ với bộ phận CSKH để được hướng dẫn gia hạn.</p>

  <p>Trân trọng,<br/>
  <strong>Học Viện Khí Tâm Trị Liệu Quốc Tế</strong></p>
</div>
`;
};

// =====================
// HÀM GỬI EMAIL
// =====================
const sendExpiryReminder = async ({ email, name, courseName, expiryDate, daysLeft, type }) => {
  const subject = `[Thông báo] Gói dịch vụ sắp hết hạn - ${courseName}`;
  const html = buildExpiryEmailHtml(name, courseName, expiryDate, daysLeft);

  try {
    const info = await transporter.sendMail({
      from: '"Học Viện Khí Tâm Trị Liệu" <tech@khitamtherapy.com>',
      to: email,
      cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com, khitamacademy@gmail.com, truongxuan.fengshuix@gmail.com',
      subject,
      html,
    });

    if (EmailLog) {
      await EmailLog.create({
        to: email,
        subject,
        html,
        status: "sent",
        messageId: info.messageId,
        type: "expiry_reminder",
      });
    }

    console.log(`✅ Đã gửi nhắc hết hạn → ${name} <${email}> (${type})`);
    return true;
  } catch (err) {
    if (EmailLog) {
      await EmailLog.create({
        to: email,
        subject,
        html,
        status: "failed",
        errorMessage: err.message,
        type: "expiry_reminder",
      });
    }
    console.error(`❌ Gửi nhắc hết hạn thất bại → ${name} <${email}> (${type}):`, err.message);
    return false;
  }
};

// =====================
// LÔGIC KIỂM TRA VÀ GỬI
// =====================
const sendExpiryReminders = async () => {
  console.log(`📧 [${new Date().toLocaleString("vi-VN")}] Bắt đầu kiểm tra nhắc hết hạn (MB4200/MBVIP)...`);

  try {
    // Tìm các pipeline đã hoàn thành HOẶC trả thẳng (Full), trừ các đơn bị Hủy
    const pipelines = await Pipeline.find({
      $or: [
        { status: "Completed" },
        { PaymentType: "Full" }
      ],
      status: { $ne: "Cancelled" }
    })
      .populate("contact")
      .populate("products")
      .populate("K.product");

    const today = moment().startOf('day');

    for (const pipeline of pipelines) {
      if (!pipeline.contact || !pipeline.contact.email) continue;

      // Gom tất cả sản phẩm
      let allProducts = [];
      if (pipeline.products && pipeline.products.length > 0) {
        allProducts = [...pipeline.products];
      }
      if (pipeline.K && pipeline.K.length > 0) {
        pipeline.K.forEach(item => {
          if (item.product) allProducts.push(item.product);
        });
      }

      // Kiểm tra TaxCode MB4200 hoặc MBVIP
      const targetProducts = allProducts.filter(p => 
        p.TaxCode === "MB4200" || p.TaxCode === "MBVIP"
      );

      if (targetProducts.length === 0) continue;

      const courseNames = targetProducts.map(p => p.name).join(", ");

      // Xác định ngày bắt đầu (Ngày thanh toán hoặc ngày tạo)
      const startDate = pipeline.paymentInfo?.paymentDate 
        ? moment(pipeline.paymentInfo.paymentDate) 
        : moment(pipeline.createdAt);
      
      const expiryDate = startDate.clone().add(1, 'year');
      const formattedExpiryDate = expiryDate.format("DD/MM/YYYY");

      // Tính số ngày còn lại
      const daysUntilExpiry = expiryDate.diff(today, 'days');

      let isSentSuccess = false;
      let reminderType = "";

      // Kiểm tra các mốc: 30 ngày (1 tháng), 10 ngày, 1 ngày
      if (daysUntilExpiry === 30 && !pipeline.expiryEmailReminders?.reminded1Month) {
        reminderType = "reminded1Month";
        isSentSuccess = await sendExpiryReminder({
          email: pipeline.contact.email,
          name: pipeline.contact.name,
          courseName: courseNames,
          expiryDate: formattedExpiryDate,
          daysLeft: 30,
          type: "1 tháng trước"
        });
      } else if (daysUntilExpiry === 10 && !pipeline.expiryEmailReminders?.reminded10Days) {
        reminderType = "reminded10Days";
        isSentSuccess = await sendExpiryReminder({
          email: pipeline.contact.email,
          name: pipeline.contact.name,
          courseName: courseNames,
          expiryDate: formattedExpiryDate,
          daysLeft: 10,
          type: "10 ngày trước"
        });
      } else if (daysUntilExpiry === 1 && !pipeline.expiryEmailReminders?.reminded1Day) {
        reminderType = "reminded1Day";
        isSentSuccess = await sendExpiryReminder({
          email: pipeline.contact.email,
          name: pipeline.contact.name,
          courseName: courseNames,
          expiryDate: formattedExpiryDate,
          daysLeft: 1,
          type: "1 ngày trước"
        });
      }

      if (isSentSuccess && reminderType) {
        if (!pipeline.expiryEmailReminders) {
          pipeline.expiryEmailReminders = {};
        }
        pipeline.expiryEmailReminders[reminderType] = true;
        await pipeline.save();
      }
    }
    console.log(`✅ Hoàn tất kiểm tra nhắc hết hạn.`);
  } catch (error) {
    console.error("❌ Lỗi khi chạy cron nhắc hết hạn:", error);
  }
};

// =====================
// CRON: chạy mỗi ngày lúc 08:00 sáng
// =====================
cron.schedule("00 08 * * *", sendExpiryReminders, {
  timezone: "Asia/Ho_Chi_Minh",
});

console.log("⏰ Cron nhắc hết hạn (MB4200/MBVIP) đã được đăng ký (chạy 08:00 mỗi ngày)");

module.exports = { sendExpiryReminders };
