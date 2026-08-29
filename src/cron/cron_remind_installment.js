const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Pipeline = require("../models/pineline.model"); // Verify path
const EmailLog = require("../models/EmailLog.model");
const Contact = require("../models/contact.model"); // Ensure Contact schema is registered
const Product = require("../models/product.model"); // Ensure Product schema is registered

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
// NỘI DUNG EMAIL - NHẮC TRƯỚC 7 NGÀY
// =====================
const buildEmailHtml7Days = (name, courseName, amount, expectedDate, productCode) => `
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
  <p>Xin chào <strong>${name}</strong>,</p>

  <p>Học Viện Khí Tâm xin thông báo:</p>

  <p>Kỳ thanh toán tiếp theo của khóa học <strong>${courseName}</strong> sẽ đến hạn vào ngày <strong>${expectedDate}</strong>.</p>
  
  <p>Số tiền cần thanh toán: <strong style="color: red;">${amount.toLocaleString("vi-VN")} VNĐ</strong></p>

  <p>Bạn có thể chủ động hoàn tất thanh toán trước hạn để đảm bảo quá trình học tập không bị gián đoạn.</p>

  <p><strong>Thực hiện thanh toán tại đây:</strong></p>
  <ul>
    <li>Tên tài khoản: <strong>CTCP KHI TAM CONG NGHE SUC KHOE VN</strong></li>
    <li>Số tài khoản: <strong>1037757201</strong></li>
    <li>Ngân hàng: <strong>Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank – Tân Định, PGD Mạc Đĩnh Chi)</strong></li>
    <li>Nội dung chuyển khoản: <strong>${name} - ${productCode}</strong></li>
  </ul>

  <p>Trân trọng,<br/>
  <strong>Học Viện Khí Tâm Trị Liệu Quốc Tế</strong></p>
</div>
`;

// =====================
// NỘI DUNG EMAIL - NHẮC GẦN HẠN (1 NGÀY VÀ ĐÚNG HẠN)
// =====================
const buildEmailHtml1Day = (name, courseName, amount, expectedDate, installmentNumber, productCode) => `
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
  <p>Xin chào <strong>${name}</strong>,</p>

  <p>Học Viện Khí Tâm xin thông báo:</p>

  <p>Hôm nay (<strong>${expectedDate}</strong>) là hạn thanh toán kỳ <strong>${installmentNumber}</strong> của khóa học <strong>${courseName}</strong>.</p>
  
  <p>Số tiền cần thanh toán: <strong style="color: red;">${amount.toLocaleString("vi-VN")} VNĐ</strong></p>

  <p>Bạn vui lòng hoàn tất thanh toán trong hôm nay để duy trì quyền truy cập vào khoá học, đảm bảo quá trình học tập không bị gián đoạn.</p>

  <p><strong>Thực hiện thanh toán tại đây:</strong></p>
  <ul>
    <li>Tên tài khoản: <strong>CTCP KHI TAM CONG NGHE SUC KHOE VN</strong></li>
    <li>Số tài khoản: <strong>1037757201</strong></li>
    <li>Ngân hàng: <strong>Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank – Tân Định, PGD Mạc Đĩnh Chi)</strong></li>
    <li>Nội dung chuyển khoản: <strong>${name} - ${productCode}</strong></li>
  </ul>

  <p>Trân trọng,<br/>
  <strong>Học Viện Khí Tâm Trị Liệu Quốc Tế</strong></p>
</div>
`;

// =====================
// HÀM GỬI EMAIL
// =====================
const sendReminder = async ({ email, name, courseName, amount, expectedDate, installmentNumber, productCode, is7DaysBefore }) => {
  const subject = is7DaysBefore
    ? `[Thông báo] Kỳ thanh toán sắp đến hạn - ${courseName}`
    : `[Nhắc nhở] Hạn thanh toán kỳ ${installmentNumber} - ${courseName}`;

  const html = is7DaysBefore
    ? buildEmailHtml7Days(name, courseName, amount, expectedDate, productCode)
    : buildEmailHtml1Day(name, courseName, amount, expectedDate, installmentNumber, productCode);

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
        type: "reminder",
      });
    }

    console.log(`✅ Đã gửi nhắc thanh toán trả góp → ${name} <${email}> đợt ${installmentNumber} (Trước ${is7DaysBefore ? 7 : '1/0'} ngày)`);
    return true;
  } catch (err) {
    if (EmailLog) {
      await EmailLog.create({
        to: email,
        subject,
        html,
        status: "failed",
        errorMessage: err.message,
        type: "reminder",
      });
    }
    console.error(`❌ Gửi thất bại → ${name} <${email}> đợt ${installmentNumber}:`, err.message);
    return false;
  }
};

// =====================
// LÔGIC KIỂM TRA VÀ GỬI
// =====================
const sendInstallmentReminders = async () => {
  console.log(`📧 [${new Date().toLocaleString("vi-VN")}] Bắt đầu gửi email nhắc thanh toán trả góp...`);

  try {
    // Tìm các pipeline có hình thức Installment, chưa Cancelled, có đợt thanh toán chưa trả
    const pipelines = await Pipeline.find({
      PaymentType: "Install",
      status: { $ne: "Cancelled" },
      "installments.isPaid": false
    })
      .populate("contact")
      .populate("products")
      .populate("K.product");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const pipeline of pipelines) {
      if (!pipeline.contact || !pipeline.contact.email) continue;

      let allProducts = [];
      if (pipeline.products && pipeline.products.length > 0) {
        allProducts = [...pipeline.products];
      }
      if (pipeline.K && pipeline.K.length > 0) {
        pipeline.K.forEach(item => {
          if (item.product) allProducts.push(item.product);
        });
      }

      const courseName = allProducts.length > 0
        ? allProducts.map(p => p.name).join(", ")
        : "Khóa học/Dịch vụ";

      const productCode = allProducts.length > 0
        ? allProducts.map(p => p.productCode || (p._id ? p._id.toString().slice(-4) : "")).join(", ")
        : pipeline.orderCode;

      for (const installment of pipeline.installments) {
        if (!installment.isPaid && installment.expectedDate) {
          const expectedDate = new Date(installment.expectedDate);
          expectedDate.setHours(0, 0, 0, 0);

          const diffTime = expectedDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const formattedDate = expectedDate.toLocaleDateString("vi-VN");

          let isSentSuccess = false;

          if (!installment.isEmailSent) {
            // Nhắc nhở trước 7 ngày (Thêm 4 ngày để test tạm thời)
            if (diffDays === 7 || diffDays === 4) {
              isSentSuccess = await sendReminder({
                email: pipeline.contact.email,
                name: pipeline.contact.name,
                courseName,
                amount: installment.amount,
                expectedDate: formattedDate,
                installmentNumber: installment.installmentNumber,
                productCode,
                is7DaysBefore: true
              });
            }
            // Nhắc nhở trước 1 ngày, hoặc đúng hạn, hoặc quá hạn mỗi 3 ngày
            else if (diffDays === 1 || diffDays === 0 || (diffDays < 0 && Math.abs(diffDays) % 3 === 0)) {
              isSentSuccess = await sendReminder({
                email: pipeline.contact.email,
                name: pipeline.contact.name,
                courseName,
                amount: installment.amount,
                expectedDate: formattedDate,
                installmentNumber: installment.installmentNumber,
                productCode,
                is7DaysBefore: false
              });
            }

            if (isSentSuccess) {
              installment.isEmailSent = true;
              await pipeline.save();
            }
          }
        }
      }
    }
    console.log(`✅ Hoàn tất kiểm tra nhắc thanh toán trả góp.`);
  } catch (error) {
    console.error("❌ Lỗi khi chạy cron nhắc thanh toán trả góp:", error);
  }
};

// =====================
// CRON: chạy mỗi ngày lúc 19:08
// =====================
cron.schedule("08 19 * * *", sendInstallmentReminders, {
  timezone: "Asia/Ho_Chi_Minh",
});

console.log("⏰ Cron nhắc thanh toán trả góp đã được đăng ký (chạy 19:08 mỗi ngày)");

module.exports = { sendInstallmentReminders };
