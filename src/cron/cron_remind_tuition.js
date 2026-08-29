const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ContactPortal = require('../models/contactprotal.model');
const EmailLog = require('../models/EmailLog.model');
const Pipeline = require('../models/pineline.model');
const Contact = require('../models/contact.model');

// =====================
// TRANSPORTER
// =====================
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: 'tech@khitamtherapy.com',
        pass: 'gHyK2h$xU3VL',
    },
    tls: { rejectUnauthorized: false },
});

// =====================
// NỘI DUNG EMAIL
// =====================
const buildEmailHtml = (name, dueDateStr) => `
<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.8;">
  <p>Kính gửi <strong>${name}</strong>,</p>

  <p>Học Viện Khí Tâm Trị Liệu Quốc Tế xin gửi lời thăm hỏi và chúc anh/chị luôn giữ vững tinh thần an yên, tích cực trên hành trình đồng hành cùng dự án <strong>Chiến Binh K</strong>.</p>

  <p>Chúng tôi xin phép nhắc anh/chị về thời hạn đóng phí tập luyện định kỳ <strong>(500.000 VNĐ/tháng)</strong> vào <strong>ngày ${dueDateStr}</strong> sắp tới. Việc duy trì đóng phí đúng hạn sẽ giúp anh/chị tiếp tục tham gia đầy đủ các buổi tập luyện và nhận được sự đồng hành liên tục từ đội ngũ hướng dẫn.</p>

  <p><strong>Thông tin tài khoản nhận thanh toán:</strong></p>
  <ul>
    <li>Tên tài khoản: <strong>CTCP KHI TAM CONG NGHE SUC KHOE VN</strong></li>
    <li>Số tài khoản: <strong>1037757201</strong></li>
    <li>Ngân hàng: <strong>Vietcombank – Tân Định, PGD Mạc Đĩnh Chi</strong></li>
    <li>Nội dung chuyển khoản: <strong>Họ tên_KH07</strong></li>
  </ul>

  <p>Trong trường hợp anh/chị đã hoàn tất thanh toán, xin vui lòng bỏ qua email này. Nếu cần hỗ trợ hoặc có bất kỳ khó khăn nào, anh/chị đừng ngần ngại chia sẻ với chúng tôi.</p>

  <p>📞 SĐT/Zalo hỗ trợ: <strong>Ms. Kiều Vân – 036.384.8865</strong></p>

  <p>Học Viện luôn trân trọng sự tin tưởng và đồng hành của anh/chị, và mong tiếp tục cùng anh/chị vun bồi sức khỏe thân – tâm – trí một cách bền vững.</p>

  <p>Trân trọng,<br/>
  <strong>Học Viện Khí Tâm Trị Liệu Quốc Tế</strong></p>
</div>
`;

// =====================
// HÀM GỬI EMAIL CHO 1 HỌC VIÊN
// =====================
const sendReminderToOne = async ({ name, email, dueDateStr }) => {
    const subject = `[Nhắc nhở] Đóng học phí tháng – Dự án Chiến Binh K`;
    const html = buildEmailHtml(name, dueDateStr);

    try {
        const info = await transporter.sendMail({
            from: '"Học Viện Khí Tâm Trị Liệu" <tech@khitamtherapy.com>',
            to: email,
            subject,
            cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com, khitamacademy@gmail.com, truongxuan.fengshuix@gmail.com',
            html,
        });

        await EmailLog.create({
            to: email,
            subject,
            html,
            status: 'sent',
            messageId: info.messageId,
            type: 'reminder',
        });

        console.log(`✅ Đã gửi nhắc học phí → ${name} <${email}> (Hạn: ${dueDateStr})`);
    } catch (err) {
        await EmailLog.create({
            to: email,
            subject,
            html,
            status: 'failed',
            errorMessage: err.message,
            type: 'reminder',
        });
        console.error(`❌ Gửi thất bại → ${name} <${email}>:`, err.message);
    }
};

// =====================
// HÀM GỬI CHO TOÀN BỘ DANH SÁCH TỪ DB (MỖI NGÀY)
// =====================
const sendTuitionReminders = async () => {
    console.log(`📧 [${new Date().toLocaleString('vi-VN')}] Bắt đầu kiểm tra và gửi email nhắc học phí Chiến Binh K (nhắc trước 7 ngày)...`);
    try {
        const productId = '69b41576d7cca79b3233e217'; // ID Hành trình chiến binh K
        const pipelines = await Pipeline.find({
            stage: "Hoàn tất thu tiền",
            products: productId
        }).populate('contact', 'email name');

        const today = new Date();
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + 7); // Ngày mục tiêu là 7 ngày sau (ngày khách phải đóng tiền)

        const studentsToRemind = [];

        pipelines.forEach(p => {
            if (!p.contact || !p.contact.email || !p.createdAt) return;

            const purchaseDate = new Date(p.createdAt);
            let purchaseDay = purchaseDate.getDate();

            // Xử lý edge case: nếu ngày mua là 31, nhưng tháng mục tiêu chỉ có 30 ngày (hoặc 28, 29 của T2)
            const daysInTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
            if (purchaseDay > daysInTargetMonth) {
                purchaseDay = daysInTargetMonth; // Đẩy về ngày cuối cùng của tháng mục tiêu
            }

            // Nếu 7 ngày sau đúng bằng ngày đóng học phí hàng tháng
            if (targetDate.getDate() === purchaseDay) {
                const dueDateStr = `${purchaseDay}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`;
                studentsToRemind.push({
                    name: p.contact.name || 'Học viên',
                    email: p.contact.email,
                    dueDateStr: dueDateStr
                });
            }
        });

        console.log(`📊 Tìm thấy ${studentsToRemind.length} học viên đến hạn đóng học phí sau 7 ngày nữa.`);

        for (const hv of studentsToRemind) {
            await sendReminderToOne(hv);
        }
        console.log(`✅ Hoàn tất kiểm tra gửi email nhắc học phí hôm nay.`);
    } catch (error) {
        console.error(`❌ Lỗi khi lấy danh sách học viên hoặc gửi email:`, error.message);
    }
};

// =====================
// CRON: chạy hàng ngày lúc 8:00 sáng
// Cú pháp: '0 8 * * *' = 08:00 mỗi ngày
// =====================
cron.schedule('0 8 * * *', sendTuitionReminders, {
    timezone: 'Asia/Ho_Chi_Minh',
});

console.log('⏰ Cron nhắc học phí Chiến Binh K đã được đăng ký (Chạy hàng ngày lúc 8:00)');

// Export để có thể gọi thủ công qua API
module.exports = { sendTuitionReminders };
