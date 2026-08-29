const Pipeline = require("../models/pineline.model");
const InstallmentPlan = require("../models/InstallmentPlan.model");
const Contact = require("../models/contact.model");
const User = require("../models/user.model");
const Team = require("../models/team.model");
const Note = require("../models/notes.model");
const KPI = require("../models/kpi.model");
const Product = require("../models/product.model");
const express = require("express");
const multer = require("multer");
const path = require("path");
const { ObjectId } = require("mongoose");
const ActionLog = require("../models/actionlog.model"); // Import ActionLog model
const nodemailer = require("nodemailer");
const AffiliateReport = require("../models/reportaff.model");
const { model } = require("mongoose");
const mongoose = require('mongoose');
const fs = require("fs");
// Tạo thư mục 'uploads' nếu chưa tồn tại
const app = express();
app.use(express.json());

// Đảm bảo thư mục 'uploads/' tồn tại
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Thư mục 'uploads/' đã được tạo thành công.");
}

exports.updatePipelineStatus = async (req, res) => {
  const { id } = req.params;
  const { status, userId, createdBy } = req.body;
  const operatorId = userId || createdBy;

  try {
    const pipeline = await Pipeline.findById(id)
      .populate("createdBy")
      .populate("contact")
      .populate({
        path: "products",
        select: "name category",
      });

    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline không tồn tại." });
    }

    const oldPipeline = JSON.parse(JSON.stringify(pipeline));

    pipeline.status = status;

    // ✅ Logic duyệt trả góp tuần tự
    if (status === "Installment") {
      const firstConfirmed = pipeline.firstPaymentConfirmed;

      if (!firstConfirmed) {
        // ── Lần đầu: KT duyệt Pending → Installment ──────────────────
        // Xác nhận đã thu tiền đầu (Firstpayment), chưa thu đợt nào trong installments
        pipeline.firstPaymentConfirmed = true;
        console.log(`[INSTALLMENT] Lần đầu duyệt - Xác nhận Firstpayment đã thu. OrderCode: ${pipeline.orderCode}`);
        
        // 📧 Gửi email xác nhận đã nhận tiền cọc/lần đầu
        if (pipeline.contact?.email) {
          const productNames = (pipeline.products || []).map(p => p.name).join(', ');
          const nextUnpaid = (pipeline.installments || [])
            .filter(i => !i.isPaid)
            .sort((a, b) => a.installmentNumber - b.installmentNumber)[0] || null;

          await sendInstallmentPerPaymentEmail(
            pipeline.contact.email, 
            pipeline.contact.name || 'Quý khách hàng', 
            productNames, 
            { installmentNumber: 'Đặc biệt (Tiền cọc)', amount: pipeline.Firstpayment }, 
            nextUnpaid, 
            pipeline.orderCode
          );
        }
      } else {
        // Nếu đã xác nhận Firstpayment rồi thì chỉ đơn giản là chuyển status về Installment
        // Không tự động đánh dấu trả các đợt ở đây nữa vì đã có nút duyệt riêng từng đợt
        console.log(`[INSTALLMENT] Chuyển trạng thái về Installment. OrderCode: ${pipeline.orderCode}`);
      }
    }

    await pipeline.save();

    await ActionLog.create({
      entityId: pipeline._id,
      entity: "Pipeline",
      action: "UPDATE",
      oldValue: oldPipeline,
      newValue: pipeline,
      createdBy: operatorId,
    });

    if (status === "Completed") {
      const contactEmail = pipeline.contact?.email;
      const orderId = pipeline.orderCode;
      const customerName = pipeline.contact?.name || "Quý khách hàng";
      const amountTotal = pipeline.amountTotal;

      // ✅ FIX: normalize category — trim + handle object/string/array
      const categories = (pipeline.products || []).flatMap((p) => {
        const cat = p?.category;
        if (!cat) return [];
        if (Array.isArray(cat)) return cat.map((c) => (typeof c === "object" ? c?.name : c)?.trim()).filter(Boolean);
        if (typeof cat === "object") return [cat?.name?.trim()].filter(Boolean);
        return [cat.trim()];
      });

      // ✅ FIX: join productNames sau khi đã có products
      const productNames = (pipeline.products || []).map((p) => p.name).join(", ");

      console.log(`Pipeline hoàn thành! Email: ${contactEmail || "Không có"}`);
      console.log(`Products (${pipeline.products?.length}):`, JSON.stringify(pipeline.products));
      console.log(`Categories normalized:`, categories);

      if (contactEmail) {
        await sendCompletionEmail(
          contactEmail,
          customerName,
          productNames,
          amountTotal,
          orderId,
          categories,
        );
      } else {
        console.warn(`⚠️ Pipeline ${orderId} không có email liên hệ`);
      }
    }

    res.json({
      message: "Cập nhật trạng thái thành công.",
      pipeline,
    });

    // ✅ Gửi email cảm ơn trả góp nếu chuyển sang trạng thái Installment
    if (status === "Installment" && pipeline.PaymentType === "Install") {
      const contactEmail = pipeline.contact?.email;
      const customerName = pipeline.contact?.name || "Quý khách hàng";
      const productNames = (pipeline.products || []).map((p) => p.name).join(", ");
      const orderId = pipeline.orderCode;
      const firstPayment = pipeline.Firstpayment || 0;

      // Tìm kỳ thanh toán tiếp theo (kỳ đầu tiên chưa trả)
      const nextInstallment = (pipeline.installments || []).find(i => !i.isPaid);

      if (contactEmail) {
        await sendInstallmentThankYouEmail(
          contactEmail,
          customerName,
          productNames,
          firstPayment,
          nextInstallment,
          orderId
        );
      }
    }

    // ✅ Gửi email xác nhận cho khách hàng nếu status là Chốt Deal hoặc Hoàn tất thu tiền
    if (status === "Chốt Deal" || status === "Hoàn tất thu tiền") {
      await sendCustomerRegistrationEmail(pipeline);
    }
  } catch (error) {
    console.error("Error updating pipeline status:", error);
    res.status(500).json({ error: "Có lỗi xảy ra." });
  }
};
// ── Cấu hình SMTP Office365 ───────────────────────────────────────────────

// ── Cấu hình SMTP Office365 ───────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tech@khitamtherapy.com',
    pass: 'gHyK2h$xU3VL',
  },
});

// ── Hàm gửi email khi Chốt Deal ──────────────────────────────────────────
const sendChotDealEmail = async (pipeline) => {
  try {
    console.log('📧 [EMAIL] Bắt đầu gửi email Chốt Deal...');
    console.log('📧 [EMAIL] pipeline._id     :', pipeline._id);
    console.log('📧 [EMAIL] pipeline.orderCode:', pipeline.orderCode);

    // Kiểm tra kết nối SMTP trước khi gửi
    console.log('📧 [EMAIL] Đang verify SMTP...');
    await transporter.verify();
    console.log('📧 [EMAIL] ✅ SMTP verify OK');

    // Populate thông tin
    const populated = await Pipeline.findById(pipeline._id)
      .populate('user', 'name email')
      .populate('contact', 'phone')
      .populate('products', 'name price');

    console.log('📧 [EMAIL] populated.user    :', populated?.user);
    console.log('📧 [EMAIL] populated.contact :', populated?.contact);
    console.log('📧 [EMAIL] populated.products:', populated?.products);

    const productRows =
      populated?.products?.map(
        (p) => `
          <tr>
            <td style="padding:6px 10px; border-bottom:1px solid #eee;">${p.name}</td>
            <td style="padding:6px 10px; border-bottom:1px solid #eee; text-align:right;">
              ${(p.price || 0).toLocaleString('vi-VN')} VND
            </td>
          </tr>`
      ).join('') || '<tr><td colspan="2" style="padding:8px;">Không có sản phẩm</td></tr>';

    const ngayCapNhat = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    const mailOptions = {
      from: '"Khí Tâm CRM" <tech@khitamtherapy.com>',
      to: 'ketoannoibodtp2025@gmail.com',
      cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
      subject: `🎉 Chốt Deal thành công - Đơn hàng #${pipeline.orderCode}`,
      html: `
        <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;
                    padding:20px; border:1px solid #e0e0e0; border-radius:8px;">
          <h2 style="color:#054a27; border-bottom:2px solid #054a27; padding-bottom:10px;">
            🎉 Thông báo Chốt Deal mới
          </h2>
          <div style="background:#f9f9f9; padding:15px; border-radius:6px; margin:15px 0;">
            <h3 style="margin-top:0; color:#333;">Thông tin đơn hàng</h3>
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0; color:#666; width:40%;"><strong>Mã đơn hàng:</strong></td>
                <td style="padding:6px 0; color:#333;">#${pipeline.orderCode}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Khách hàng:</strong></td>
                <td style="padding:6px 0; color:#333;">${populated?.user?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Email khách:</strong></td>
                <td style="padding:6px 0; color:#333;">${populated?.user?.email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Số điện thoại:</strong></td>
                <td style="padding:6px 0; color:#333;">${populated?.contact?.phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Giai đoạn:</strong></td>
                <td style="padding:6px 0;">
                  <span style="background:#054a27; color:white; padding:2px 10px;
                               border-radius:12px; font-size:13px;">Chốt Deal ✅</span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Ngày cập nhật:</strong></td>
                <td style="padding:6px 0; color:#333;">${ngayCapNhat}</td>
              </tr>
            </table>
          </div>
          <div style="background:#f9f9f9; padding:15px; border-radius:6px; margin:15px 0;">
            <h3 style="margin-top:0; color:#333;">Sản phẩm</h3>
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:#054a27; color:white;">
                  <th style="padding:8px 10px; text-align:left;">Tên sản phẩm</th>
                  <th style="padding:8px 10px; text-align:right;">Đơn giá</th>
                </tr>
              </thead>
              <tbody>${productRows}</tbody>
            </table>
          </div>
          <div style="background:#e8f5e9; padding:15px; border-radius:6px; margin:15px 0;">
            <h3 style="margin-top:0; color:#333;">Tài chính</h3>
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Tổng tiền gốc:</strong></td>
                <td style="padding:6px 0; text-align:right;">${(pipeline.totalAmount || 0).toLocaleString('vi-VN')} VND</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Tạm ứng:</strong></td>
                <td style="padding:6px 0; text-align:right;">${(pipeline.depositAmount || 0).toLocaleString('vi-VN')} VND</td>
              </tr>
              <tr>
                <td style="padding:6px 0; color:#666;"><strong>Phụ thu:</strong></td>
                <td style="padding:6px 0; text-align:right;">${(pipeline.surcharge || 0).toLocaleString('vi-VN')} VND</td>
              </tr>
              <tr style="border-top:2px solid #054a27;">
                <td style="padding:8px 0; color:#054a27;"><strong>Tổng tiền thực tế:</strong></td>
                <td style="padding:8px 0; text-align:right; color:#054a27; font-size:16px;">
                  <strong>${(pipeline.amountTotal || 0).toLocaleString('vi-VN')} VND</strong>
                </td>
              </tr>
            </table>
          </div>
          <p style="color:#999; font-size:12px; text-align:center; margin-top:20px;">
            Email này được gửi tự động từ hệ thống <strong>Khí Tâm Therapy CRM</strong>.
          </p>
        </div>
      `,
    };

    console.log('📧 [EMAIL] Đang gửi tới:', mailOptions.to);
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 [EMAIL] ✅ Gửi thành công! messageId:', info.messageId);

  } catch (emailError) {
    console.error('📧 [EMAIL] ❌ Lỗi gửi email:');
    console.error('   message :', emailError.message);
    console.error('   code    :', emailError.code);
    console.error('   response:', emailError.response);
    console.error('   stack   :', emailError.stack);
  }
};

// ── Hàm gửi email thông báo đơn trả góp cho Kế toán ───────────────────────
const sendInstallmentNotificationToAccountant = async (pipeline) => {
  try {
    console.log('📧 [EMAIL] Bắt đầu gửi thông báo trả góp cho kế toán...');

    // Populate thông tin
    const populated = await Pipeline.findById(pipeline._id)
      .populate('user', 'name email')
      .populate('contact', 'phone');

    const ngayCapNhat = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    let installmentsHtml = '';
    if (pipeline.installments && pipeline.installments.length > 0) {
      installmentsHtml = pipeline.installments.map(p => `
        <tr>
          <td style="padding:6px 10px; border-bottom:1px solid #eee;">Kỳ ${p.installmentNumber}</td>
          <td style="padding:6px 10px; border-bottom:1px solid #eee; text-align:right;">
            ${(p.amount || 0).toLocaleString('vi-VN')} VND
          </td>
          <td style="padding:6px 10px; border-bottom:1px solid #eee; text-align:right;">
            ${new Date(p.expectedDate).toLocaleDateString('vi-VN')}
          </td>
        </tr>
      `).join('');
    }

    const mailOptions = {
      from: '"Khí Tâm CRM" <tech@khitamtherapy.com>',
      to: 'ketoannoibodtp2025@gmail.com',
      cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
      subject: `[Thông báo] Đơn hàng trả góp mới - #${pipeline.orderCode}`,
      html: `
        <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e0e0e0; border-radius:8px;">
          <h2 style="color:#B45309; border-bottom:2px solid #B45309; padding-bottom:10px;">
            ⚠️ Có đơn hàng trả góp mới
          </h2>
          <div style="background:#f9f9f9; padding:15px; border-radius:6px; margin:15px 0;">
            <h3 style="margin-top:0; color:#333;">Thông tin đơn hàng</h3>
            <table style="width:100%; border-collapse:collapse;">
              <tr><td style="padding:6px 0; color:#666; width:40%;"><strong>Mã đơn hàng:</strong></td><td style="padding:6px 0; color:#333;">#${pipeline.orderCode}</td></tr>
              <tr><td style="padding:6px 0; color:#666;"><strong>Khách hàng:</strong></td><td style="padding:6px 0; color:#333;">${populated?.user?.name || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0; color:#666;"><strong>Email:</strong></td><td style="padding:6px 0; color:#333;">${populated?.user?.email || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0; color:#666;"><strong>SĐT:</strong></td><td style="padding:6px 0; color:#333;">${populated?.contact?.phone || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0; color:#666;"><strong>Tổng tiền thực tế:</strong></td><td style="padding:6px 0; font-weight:bold; color:#1A56DB;">${(pipeline.amountTotal || 0).toLocaleString('vi-VN')} VND</td></tr>
              <tr><td style="padding:6px 0; color:#666;"><strong>Trả trước ban đầu:</strong></td><td style="padding:6px 0; font-weight:bold; color:#057A55;">${(pipeline.Firstpayment || 0).toLocaleString('vi-VN')} VND</td></tr>
              <tr><td style="padding:6px 0; color:#666;"><strong>Ngày tạo:</strong></td><td style="padding:6px 0; color:#333;">${ngayCapNhat}</td></tr>
            </table>
          </div>
          <div style="background:#FFFBEB; padding:15px; border-radius:6px; margin:15px 0;">
            <h3 style="margin-top:0; color:#333;">Lịch thanh toán dự kiến</h3>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#FDE68A; color:#92400E;">
                  <th style="padding:8px 10px; text-align:left;">Kỳ</th>
                  <th style="padding:8px 10px; text-align:right;">Số tiền</th>
                  <th style="padding:8px 10px; text-align:right;">Ngày trả</th>
                </tr>
              </thead>
              <tbody>${installmentsHtml}</tbody>
            </table>
          </div>
          <p style="color:#999; font-size:12px; text-align:center; margin-top:20px;">Email tự động từ Khí Tâm Therapy CRM.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('📧 [EMAIL] ✅ Đã gửi thông báo trả góp thành công!');
  } catch (err) {
    console.error('📧 [EMAIL] ❌ Lỗi gửi email thông báo kế toán:', err);
  }
};

// ── Hàm gửi email xác nhận đăng ký cho Khách hàng ────────────────────────
const sendCustomerRegistrationEmail = async (pipeline) => {
  try {
    console.log('📧 [EMAIL] Bắt đầu gửi email xác nhận cho khách hàng...');

    // Populate thông tin contact
    const populated = await Pipeline.findById(pipeline._id).populate('contact');
    const contactEmail = populated?.contact?.email;
    const customerName = populated?.contact?.name || 'Quý Khách hàng';

    if (!contactEmail) {
      console.warn('⚠️ [EMAIL] Không có email khách hàng, bỏ qua gửi email.');
      return;
    }

    const mailOptions = {
      from: '"Khí Tâm Therapy" <tech@khitamtherapy.com>',
      to: contactEmail,
      cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
      subject: 'Xác nhận đã nhận thông tin đăng ký khóa học',
      html: `
        <div style="font-family:Arial,sans-serif; line-height:1.6; color:#333; max-width:600px;">
          <p>Kính gửi ${customerName},</p>
          <p>Chúng tôi xin xác nhận đã nhận được thông tin đăng ký khóa học và thanh toán của Quý Khách hàng.</p>
          <p>Bộ phận Kế toán đang tiến hành kiểm tra và xác nhận thông tin thanh toán. Chúng tôi sẽ phản hồi chính thức trong vòng 24 giờ kể từ thời điểm nhận được đăng ký.</p>
          <p>Để đảm bảo trải nghiệm tốt nhất cho Quý Khách hàng, chúng tôi sẽ cập nhật thông tin chi tiết ngay sau khi hoàn tất quy trình kiểm tra.</p>
          <p>_____________________________________________________________________________________</p>
          <p>Trong trường hợp cần hỗ trợ thêm, Quý Khách hàng vui lòng phản hồi trực tiếp email này hoặc liên hệ qua các kênh sau:</p>
          <ul style="list-style:none; padding:0;">
            <li>- Tư vấn viên: <a href="mailto:consultant.training@khitamtherapy.com">consultant.training@khitamtherapy.com</a> Mrs Kiều Vân (+84 363848865)</li>
            <li>- Team hỗ trợ chuyên môn/đào tạo: <a href="mailto:academy@khitamtherapy.com">academy@khitamtherapy.com</a> Mr. Trường Xuân: (+84) 975 077 201</li>
            <li>- Team hỗ trợ kỹ thuật IT: <a href="mailto:tech@khitamtherapy.com">tech@khitamtherapy.com</a> Mr. Trung Tín: (+84) 913 306 193; Mr. Nguyễn Xuân Đức: (+84) 70 881 7979)</li>
          </ul>
          <p>Trân trọng cảm ơn Quý Khách hàng đã tin tưởng và đồng hành cùng Khí Tâm Therapy.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 [EMAIL] ✅ Đã gửi email xác nhận cho khách hàng: ${contactEmail}`);
  } catch (err) {
    console.error('📧 [EMAIL] ❌ Lỗi gửi email xác nhận cho khách hàng:', err);
  }
};

// ── Controller: updatePipelineStage ──────────────────────────────────────
exports.updatePipelineStage = async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const newStage = req.body.stage;
    const createdBy = req.body.createdBy;

    console.log('🔄 [STAGE] ========== BẮT ĐẦU UPDATE STAGE ==========');
    console.log('🔄 [STAGE] req.body      :', req.body);
    console.log('🔄 [STAGE] pipelineId   :', pipelineId);
    console.log('🔄 [STAGE] newStage     :', newStage);
    console.log('🔄 [STAGE] typeof stage :', typeof newStage);
    console.log('🔄 [STAGE] createdBy    :', createdBy);

    const pipeline = await Pipeline.findById(pipelineId);

    if (!pipeline) {
      console.log('🔄 [STAGE] ❌ Không tìm thấy pipeline với id:', pipelineId);
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    console.log('🔄 [STAGE] stage trong DB :', `"${pipeline.stage}"`);
    console.log('🔄 [STAGE] stage mới      :', `"${newStage}"`);
    console.log('🔄 [STAGE] Có thay đổi?   :', pipeline.stage !== newStage);

    if (pipeline.stage !== newStage) {
      await ActionLog.create({
        entityId: pipelineId,
        entity: 'Pipeline',
        action: 'UPDATE',
        oldValue: { stage: pipeline.stage },
        newValue: { stage: newStage },
        createdBy: createdBy,
      });
      console.log('🔄 [STAGE] ✅ Đã ghi ActionLog');

      pipeline.stage = newStage;
      await pipeline.save();
      console.log('🔄 [STAGE] ✅ Đã lưu stage mới:', pipeline.stage);

      // Log so sánh chính xác ký tự
      console.log('🔄 [STAGE] charCodes newStage:', [...newStage].map(c => c.charCodeAt(0)));

      if (newStage === 'Chốt Deal') {
        console.log('🔄 [STAGE] → ✅ Điều kiện Chốt Deal thỏa, gọi sendChotDealEmail...');
        await sendChotDealEmail(pipeline);
        await sendCustomerRegistrationEmail(pipeline); // ✅ Gửi email cho khách hàng
      } else if (newStage === 'Hoàn tất thu tiền') {
        console.log('🔄 [STAGE] → ✅ Điều kiện Hoàn tất thu tiền thỏa, gọi sendHoanTatThuTienEmail...');
        // await sendHoanTatThuTienEmail(pipeline); 
        await sendCustomerRegistrationEmail(pipeline); // ✅ Gửi email cho khách hàng
      } else {
        console.log('🔄 [STAGE] → ❌ Không phải stage đặc biệt, bỏ qua email');
      }
    } else {
      console.log('🔄 [STAGE] Stage không đổi, bỏ qua toàn bộ');
    }

    console.log('🔄 [STAGE] ========== KẾT THÚC UPDATE STAGE ==========');
    return res.status(200).json({ message: 'Pipeline updated successfully', pipeline });

  } catch (error) {
    console.error('🔄 [STAGE] ❌ Server error:', error.message);
    console.error('🔄 [STAGE] stack:', error.stack);
    return res.status(500).json({ message: 'Server error' });
  }
};
// Cấu hình Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Đường dẫn lưu file:", uploadDir); // Log đường dẫn
    cb(null, uploadDir); // Sử dụng đường dẫn tuyệt đối
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileName = `${file.fieldname}${uniqueSuffix}${path.extname(
      file.originalname
    )}`;
    console.log("Tên file được lưu:", fileName);
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Chấp nhận file hợp lệ
  } else {
    cb(new Error("Chỉ cho phép ảnh định dạng JPEG, PNG hoặc GIF!")); // Từ chối file không hợp lệ
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn kích thước file là 5MB
  fileFilter,
}).single("image"); // Chỉ chấp nhận 1 ảnh tại một thời điểm

exports.getTeamPineline = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.query;

    // Kiểm tra userId hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
    }

    // Tìm người dùng và lấy thông tin vai trò
    const user = await User.findById(userId).populate('role');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra vai trò: Chỉ Admin hoặc KTT Sale Manager được phép
    const allowedRoles = ['Admin', 'KTT Sale Manager'];
    if (!user.role || !allowedRoles.includes(user.role.name)) {
      return res.status(403).json({
        message: 'Bạn không có quyền truy cập. Chỉ Admin hoặc KTT Sale Manager được phép.'
      });
    }

    // Xử lý khoảng thời gian
    let dateFilter = {};
    if (fromDate || toDate) {
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: 'Cần cung cấp cả fromDate và toDate' });
      }

      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);

      // Kiểm tra định dạng ngày hợp lệ
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'Định dạng ngày không hợp lệ' });
      }

      // Đảm bảo endDate bao gồm cả ngày
      endDate.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      };

      // Log để debug khoảng thời gian
      console.log('Date Filter:', {
        fromDate: startDate.toISOString(),
        toDate: endDate.toISOString()
      });
    }

    // Lấy tất cả đội nhóm và populate thông tin thành viên, trưởng nhóm
    const teams = await Team.find({})
      .populate('members', 'firstname lastname email employeeCode')
      .populate('leadId', 'firstname lastname email employeeCode');

    if (!teams || teams.length === 0) {
      return res.status(200).json({
        message: 'Không có đội nhóm nào trong hệ thống',
        teams: []
      });
    }

    // Lấy thông tin pipeline cho từng đội nhóm dựa trên leadId và member._id
    const teamMembers = await Promise.all(
      teams.map(async (team) => {
        // Lấy danh sách ID của các thành viên và trưởng nhóm
        const creatorIds = team.members.map(member => member._id);
        if (team.leadId) {
          creatorIds.push(team.leadId._id); // Thêm leadId vào danh sách
        }

        // Lấy pipelines do trưởng nhóm hoặc thành viên tạo, áp dụng bộ lọc ngày nếu có
        const pipelines = await Pipeline.find({
          createdBy: { $in: creatorIds }, // Lấy pipeline của leadId và members
          ...dateFilter
        })
          .populate('user', 'firstname lastname email')
          .populate('contact', 'firstname lastname email')
          .populate('products', 'name')
          .lean();

        // Log để debug pipelines
        console.log(`Pipelines for team ${team.name}:`, pipelines.length);

        return {
          teamName: team.name,
          teamId: team._id,
          status: team.status,
          isPartnership: team.isPartnership,
          lead: team.leadId
            ? {
              id: team.leadId._id,
              firstname: team.leadId.firstname,
              lastname: team.leadId.lastname,
              email: team.leadId.email,
              employeeCode: team.leadId.employeeCode
            }
            : null,
          members: team.members.map(member => ({
            id: member._id,
            firstname: member.firstname,
            lastname: member.lastname,
            email: member.email,
            employeeCode: member.employeeCode
          })),
          pipelines: pipelines.map(pipeline => ({
            id: pipeline._id,
            user: pipeline.user
              ? {
                id: pipeline.user._id,
                firstname: pipeline.user.firstname,
                lastname: pipeline.user.lastname,
                email: pipeline.user.email
              }
              : null,
            contact: pipeline.contact
              ? {
                id: pipeline.contact._id,
                firstname: pipeline.contact.firstname,
                lastname: pipeline.contact.lastname,
                email: pipeline.contact.email
              }
              : null,
            stage: pipeline.stage,
            amountTotal: pipeline.amountTotal,
            Firstpayment: pipeline.Firstpayment,
            voucherType: pipeline.voucherType,
            voucherInt: pipeline.voucherInt,
            depositAmount: pipeline.depositAmount,
            PaymentType: pipeline.PaymentType,
            totalAmount: pipeline.totalAmount,
            expectedCloseDate: pipeline.expectedCloseDate,
            notes: pipeline.notes,
            createdBy: pipeline.createdBy,
            products: pipeline.products.map(product => ({
              id: product._id,
              name: product.name
            })),
            K: pipeline.K,
            orderCode: pipeline.orderCode,
            status: pipeline.status,
            surcharge: pipeline.surcharge,
            images: pipeline.images,
            isAffiliate: pipeline.isAffiliate,
            paymentInfo: pipeline.paymentInfo,
            createdAt: pipeline.createdAt,
            updatedAt: pipeline.updatedAt
          }))
        };
      })
    );

    // Trả về kết quả
    res.status(200).json({
      message: 'Lấy danh sách thành viên và pipeline thành công',
      teams: teamMembers
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách thành viên và pipeline:', error);
    res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
  }
};
// ─── Helper: gửi email cảm ơn từng đợt trả góp ─────────────────────────────
async function sendInstallmentPerPaymentEmail(contactEmail, customerName, productNames, paidInstallment, nextInstallment, orderId) {
  try {
    console.log(`[HELPER] Đang xử lý email. Đợt paid: ${paidInstallment.installmentNumber || 'N/A'}`);
    const paidAmount = (paidInstallment.amount || paidInstallment.PaidAmount || 0).toLocaleString('vi-VN');
    const paidNum = paidInstallment.installmentNumber;
    const paidAt = new Date().toLocaleDateString('vi-VN');

    let nextHtml = '';
    if (nextInstallment) {
      const nextAmt = (nextInstallment.amount || nextInstallment.PaidAmount || 0).toLocaleString('vi-VN');
      const nextDate = nextInstallment.expectedDate || nextInstallment.dueDate
        ? new Date(nextInstallment.expectedDate || nextInstallment.dueDate).toLocaleDateString('vi-VN')
        : '—';
      nextHtml = `
        <div style="background:#fffbeb;padding:14px 18px;border-radius:8px;border:1px solid #fde68a;margin-top:16px;">
          <p style="margin:0 0 6px;font-weight:700;color:#92400e;">🗓️ Kỳ thanh toán tiếp theo</p>
          <p style="margin:3px 0;">Số tiền: <strong style="color:#b45309;">${nextAmt} VND</strong></p>
          <p style="margin:3px 0;">Hạn thanh toán: <strong>${nextDate}</strong></p>
          <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Vui lòng chuyển khoản trước hạn và thông báo cho nhân viên tư vấn.</p>
        </div>`;
    } else {
      nextHtml = `<div style="background:#d1fae5;padding:14px 18px;border-radius:8px;border:1px solid #a7f3d0;margin-top:16px;"><p style="margin:0;font-weight:700;color:#065f46;">🎉 Chúc mừng! Bạn đã hoàn tất tất cả các kỳ thanh toán.</p></div>`;
    }

    const mailOptions = {
      from: '"Học Viện Khí Tâm Trị Liệu" <tech@khitamtherapy.com>',
      to: contactEmail,
      cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
      subject: `[Xác nhận] Đã nhận thanh toán Đợt ${paidNum} - Đơn hàng #${orderId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;color:#1f2937;">
          <div style="text-align:center;padding-bottom:20px;border-bottom:2px solid #054a27;">
            <h2 style="color:#054a27;margin:0;">✅ Xác nhận thanh toán trả góp</h2>
            <p style="color:#6b7280;margin:4px 0 0;">Học Viện Khí Tâm Trị Liệu Quốc Tế</p>
          </div>
          <p style="margin-top:20px;">Kính gửi <strong>${customerName}</strong>,</p>
          <p>Học viện xác nhận đã nhận được khoản thanh toán <strong>Đợt ${paidNum}</strong> cho khóa học <strong>${productNames}</strong>.</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0 0 8px;font-weight:700;color:#374151;">📋 Chi tiết thanh toán</p>
            <p style="margin:3px 0;">Mã đơn hàng: <strong>#${orderId}</strong></p>
            <p style="margin:3px 0;">Đợt thanh toán: <strong>Đợt ${paidNum}</strong></p>
            <p style="margin:3px 0;">Số tiền đã nhận: <strong style="color:#054a27;font-size:16px;">${paidAmount} VND</strong></p>
            <p style="margin:3px 0;">Ngày xác nhận: <strong>${paidAt}</strong></p>
          </div>
          ${nextHtml}
          <div style="background:#e8f5e9;padding:14px 18px;border-radius:8px;margin-top:16px;">
            <p style="margin:0 0 6px;font-weight:700;color:#054a27;">💳 Thông tin chuyển khoản</p>
            <p style="margin:3px 0;">Tên TK: <strong>CTCP KHI TAM CONG NGHE SUC KHOE VN</strong></p>
            <p style="margin:3px 0;">Số TK: <strong>1037757201</strong> — Vietcombank</p>
            <p style="margin:3px 0;">Nội dung: <strong>${customerName} - #${orderId}</strong></p>
          </div>
          <p style="margin-top:20px;font-size:13px;color:#6b7280;">Nếu cần hỗ trợ, liên hệ: <a href="mailto:consultant.training@khitamtherapy.com">consultant.training@khitamtherapy.com</a></p>
          <p style="margin-top:4px;">Trân trọng,<br/><strong>Học Viện Khí Tâm Trị Liệu Quốc Tế</strong></p>
        </div>`,
    };

    const t = nodemailer.createTransport({ host: 'smtp.office365.com', port: 587, secure: false, auth: { user: 'tech@khitamtherapy.com', pass: 'gHyK2h$xU3VL' } });
    await t.sendMail(mailOptions);
    console.log(`✅ [INSTALLMENT_EMAIL] Đã gửi xác nhận đợt ${paidNum} → ${contactEmail}`);
  } catch (err) {
    console.error('❌ [INSTALLMENT_EMAIL] Lỗi gửi email từng đợt:', err.message);
  }
}

exports.updateInstallmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, userId } = req.body;

    // 1. Update InstallmentPlan
    const installment = await InstallmentPlan.findById(id);
    if (!installment) {
      return res.status(404).json({ message: 'Không tìm thấy khoản trả góp.' });
    }
    const oldStatus = installment.Status;
    installment.Status = status;
    if (status === 'Completed' && !installment.paidAt) installment.paidAt = new Date();
    await installment.save();

    // 2. Sync Pipeline installments[]
    const pipeline = await Pipeline.findOne({ orderCode: installment.orderCode })
      .populate('contact', 'email name')
      .populate('products', 'name');

    if (pipeline) {
      const instNumMatch = installment.installmentNumber.match(/\d+/);
      const instNum = instNumMatch ? parseInt(instNumMatch[0]) : null;

      if (instNum !== null) {
        const target = pipeline.installments.find(i => i.installmentNumber === instNum);
        if (target) {
          target.isPaid = (status === 'Completed');
          if (status === 'Completed') target.actualPaymentDate = new Date();
          pipeline.markModified('installments');
        }
      }

      // Luôn chuyển trạng thái đơn hàng về Installment khi có bất kỳ đợt nào được duyệt
      // trừ khi đơn hàng đã được kế toán chủ động chuyển sang trạng thái khác (như Cancelled)
      if (status === 'Completed' && pipeline.status !== 'Completed') {
        pipeline.status = 'Installment';
      }

      await pipeline.save();

      // 3. ActionLog
      await ActionLog.create({
        entityId: pipeline._id,
        entity: 'Pipeline',
        action: 'UPDATE_INSTALLMENT',
        oldValue: { installmentNumber: installment.installmentNumber, status: oldStatus },
        newValue: { installmentNumber: installment.installmentNumber, status },
        createdBy: userId || pipeline.createdBy,
      });

      // 4. Send per-installment thank-you email when approved
      if (status === 'Completed') {
        const contactEmail = pipeline.contact?.email;
        const customerName = pipeline.contact?.name || 'Quý khách hàng';
        const productNames = (pipeline.products || []).map(p => p.name).join(', ');

        console.log(`[EMAIL] Bắt đầu chuẩn bị gửi email cho Đợt ${installment.installmentNumber}. Email: ${contactEmail || 'N/A'}`);

        // Find next unpaid installment
        const nextUnpaid = pipeline.installments
          .filter(i => !i.isPaid)
          .sort((a, b) => a.installmentNumber - b.installmentNumber)[0] || null;

        if (contactEmail) {
          try {
            await sendInstallmentPerPaymentEmail(
              contactEmail, customerName, productNames,
              installment, nextUnpaid, pipeline.orderCode
            );
            console.log(`[EMAIL] Gửi email thành công cho Đợt ${installment.installmentNumber}`);
          } catch (mailErr) {
            console.error(`[EMAIL] ❌ Lỗi gửi email cho Đợt ${installment.installmentNumber}:`, mailErr.message);
            // Vẫn trả về 200 vì data đã update, chỉ lỗi email
          }
        } else {
          console.warn(`[EMAIL] ⚠️ Không có email liên hệ để gửi cho Đợt ${installment.installmentNumber}`);
        }
      }
    }

    return res.status(200).json({ message: 'Cập nhật trạng thái thành công.' });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};



// Hàm tạo Pipeline và xử lý ảnh
// exports.createPipeline = async (req, res) => {
//   try {
//     // Xử lý upload ảnh (không bắt buộc)
//     upload(req, res, async (err) => {
//       if (err && err.message !== "Unexpected field") {
//         return res
//           .status(400)
//           .json({ message: "Error uploading image", error: err.message });
//       }

//       const {
//         user,
//         stage,
//         contact,
//         amountTotal,
//         expectedCloseDate,
//         notes,
//         paymentPlans,
//         products,
//         createdBy,
//         voucherType,
//         PaymentType,
//         voucherInt,
//         Firstpayment,
//         totalAmount,
//         depositAmount,
//         K,
//       } = req.body;

//       // Kiểm tra và xử lý voucherType, nếu trống thì gán mặc định "Percent"
//       const validVoucherType =
//         voucherType && (voucherType === "Percent" || voucherType === "Amount")
//           ? voucherType
//           : "Percent";

//       // Kiểm tra mảng products
//       if (!products || !Array.isArray(products)) {
//         return res.status(400).json({ message: "Products must be an array." });
//       }

//       // Kiểm tra và xử lý mảng K
//       if (K && Array.isArray(K)) {
//         K.forEach((kItem) => {
//           if (!kItem.product || !kItem.value) {
//             throw new Error("Each K must include product and value.");
//           }
//         });
//       } else if (K) {
//         throw new Error("K must be an array.");
//       }

//       // Xử lý ảnh upload (nếu có), nếu không có ảnh thì để mảng rỗng
//       const images = req.file
//         ? [
//             {
//               url: `/uploads/${req.file.filename}`, // Đường dẫn URL để truy cập ảnh
//               filename: req.file.filename, // Tên file ảnh
//             },
//           ]
//         : [];

//       // Tạo một pipeline mới
//       const pipeline = new Pipeline({
//         user,
//         stage,
//         contact,
//         amountTotal,
//         expectedCloseDate,
//         notes: notes?.trim(),
//         products,
//         createdBy,
//         voucherType: validVoucherType, // Sử dụng giá trị hợp lệ cho voucherType
//         PaymentType,
//         voucherInt,
//         paymentPlans,
//         Firstpayment,
//         totalAmount,
//         depositAmount: depositAmount || 0,
//         K: Array.isArray(K) ? K : [],
//         images, // Lưu thông tin ảnh vào trong Pipeline (nếu có)
//       });

//       // Lưu Pipeline vào cơ sở dữ liệu
//       const savedPipeline = await pipeline.save();
//       // Nếu PaymentType là 'Install' và stage là 'Chia thành nhiều đợt', tạo kế hoạch trả góp
//       if (PaymentType === "Install") {
//         const plans = paymentPlans.map((plan, index) => {
//           let amountRemaining = amountTotal; // Khởi tạo amountRemaining là tổng tiền ban đầu.

//           // Kiểm tra nếu thanh toán trước đó đã thành công, thì mới giảm amountRemaining
//           if (index > 0 && paymentPlans[index - 1].status === "paid") {
//             amountRemaining -= paymentPlans[index - 1].amountDue;
//           }

//           // Tạo kế hoạch trả góp cho lần thanh toán hiện tại
//           return {
//             orderCode: savedPipeline.orderCode,
//             TotalAmount: amountTotal, // Số tiền tổng ban đầu.
//             PaidAmount: plan.amountDue, // Số tiền thanh toán cho lần này.
//             RemainAmount: amountRemaining, // Số tiền còn lại sau các lần thanh toán trước.
//             NoOfPayment: paymentPlans.length, // Tổng số lần thanh toán.
//             Status: "pending", // Trạng thái mặc định là 'pending'.
//             installmentNumber: `Lần ${index + 1}`, // Thêm thông tin số lần thanh toán (Lần 1, Lần 2, Lần 3)
//           };
//         });

//         // Thêm các kế hoạch trả góp vào cơ sở dữ liệu
//         await InstallmentPlan.insertMany(plans);
//       }

//       // Trả về phản hồi
//       res.status(201).json({
//         message: "Pipeline has been created successfully!",
//         pipeline: savedPipeline,
//       });
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };

exports.createPipeline = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err && err.message !== "Unexpected field") {
        return res
          .status(400)
          .json({ message: "Error uploading image", error: err.message });
      }

      const {
        user,
        stage,
        contact,
        amountTotal,
        expectedCloseDate,
        notes,
        paymentPlans,
        products,
        createdBy,
        voucherType,
        PaymentType,
        voucherInt,
        Firstpayment,
        totalAmount,
        depositAmount,
        surcharge,
        K,
        isBusinessPartner, // ✅ THÊM
      } = req.body;

      const validVoucherType =
        voucherType && (voucherType === "Percent" || voucherType === "Amount")
          ? voucherType
          : "Percent";

      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ message: "Products must be an array." });
      }

      if (K && Array.isArray(K)) {
        K.forEach((kItem) => {
          if (!kItem.product || !kItem.value) {
            throw new Error("Each K must include product and value.");
          }
        });
      } else if (K) {
        throw new Error("K must be an array.");
      }

      const images = req.file
        ? [{ url: `/uploads/${req.file.filename}`, filename: req.file.filename }]
        : [];

      const contactData = await Contact.findById(contact).select("email name phone");
      if (!contactData) {
        return res.status(404).json({ message: "Contact not found." });
      }

      const affiliateReport = await AffiliateReport.findOne({
        $or: [
          { email: contactData.email },
          { full_name: contactData.name },
          { phone: contactData.phone },
        ],
      });

      let installmentsArray = [];
      if (PaymentType === "Install") {
        if (!paymentPlans || !Array.isArray(paymentPlans) || paymentPlans.length === 0) {
          return res.status(400).json({ message: "Vui lòng nhập danh sách các kỳ trả góp." });
        }

        // Validate từng kỳ trả góp phải có amountDue và dueDate
        for (let i = 0; i < paymentPlans.length; i++) {
          const plan = paymentPlans[i];
          if (!plan.amountDue || isNaN(Number(plan.amountDue)) || Number(plan.amountDue) <= 0) {
            return res.status(400).json({ message: `Lần ${i + 1}: Số tiền trả không hợp lệ.` });
          }
          if (!plan.dueDate) {
            return res.status(400).json({ message: `Lần ${i + 1}: Vui lòng nhập ngày trả.` });
          }

          installmentsArray.push({
            installmentNumber: i + 1,
            amount: Number(plan.amountDue),
            expectedDate: new Date(plan.dueDate),
            isPaid: false
          });
        }
      }

      const pipeline = new Pipeline({
        user,
        stage,
        contact,
        amountTotal,
        expectedCloseDate,
        notes: notes?.trim(),
        products,
        createdBy,
        voucherType: validVoucherType,
        PaymentType,
        voucherInt,
        Firstpayment,
        totalAmount,
        depositAmount: depositAmount || 0,
        surcharge: surcharge || 0,
        K: Array.isArray(K) ? K : [],
        images,
        isAffiliate: !!affiliateReport,
        isBusinessPartner: isBusinessPartner === true || isBusinessPartner === "true", // ✅ THÊM
        installments: installmentsArray // ✅ Đã lưu trực tiếp vào Pipeline
      });

      const savedPipeline = await pipeline.save();

      if (PaymentType === "Install") {
        // Vẫn giữ lại phần lưu sang collection InstallmentPlan nếu FE/hệ thống còn phụ thuộc
        let cumulativePaid = 0;
        const plans = paymentPlans.map((plan, index) => {
          const remainAmount = Number(amountTotal) - cumulativePaid;
          cumulativePaid += Number(plan.amountDue);
          return {
            orderCode: savedPipeline.orderCode,
            TotalAmount: Number(amountTotal),
            PaidAmount: Number(plan.amountDue),
            RemainAmount: remainAmount,
            NoOfPayment: paymentPlans.length,
            dueDate: new Date(plan.dueDate),
            Status: "pending",
            installmentNumber: `Lần ${index + 1}`,
          };
        });

        await InstallmentPlan.insertMany(plans);

        // Gửi email thông báo cho kế toán
        await sendInstallmentNotificationToAccountant(savedPipeline);
      }

      // ✅ Gửi email xác nhận cho khách hàng nếu stage là Chốt Deal, Hoàn tất thu tiền hoặc Trả góp
      if (stage === 'Chốt Deal' || stage === 'Hoàn tất thu tiền' || PaymentType === "Install") {
        await sendCustomerRegistrationEmail(savedPipeline);
      }

      res.status(201).json({
        message: "Pipeline has been created successfully!",
        pipeline: savedPipeline,
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

exports.updatePipeline = async (req, res) => {
  const { id } = req.params;
  try {
    upload(req, res, async (err) => {
      if (err && err.message !== "Unexpected field") {
        return res
          .status(400)
          .json({ message: "Error uploading image", error: err.message });
      }

      const {
        user,
        stage,
        contact,
        amountTotal,
        expectedCloseDate,
        notes,
        paymentPlans,
        products,
        createdBy,
        voucherType,
        PaymentType,
        voucherInt,
        Firstpayment,
        totalAmount,
        depositAmount,
        surcharge,
        K,
        isBusinessPartner,
      } = req.body;

      const pipeline = await Pipeline.findById(id);
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found." });
      }

      const oldPipeline = JSON.parse(JSON.stringify(pipeline));

      // Update basic fields
      if (user) pipeline.user = user;
      if (stage) pipeline.stage = stage;
      if (contact) {
        pipeline.contact = contact;
        // Recalculate affiliate status if contact changed
        const contactData = await Contact.findById(contact).select("email name phone");
        if (contactData) {
          const affiliateReport = await AffiliateReport.findOne({
            $or: [
              { email: contactData.email },
              { full_name: contactData.name },
              { phone: contactData.phone },
            ],
          });
          pipeline.isAffiliate = !!affiliateReport;
        }
      }
      if (amountTotal !== undefined) pipeline.amountTotal = amountTotal;
      if (notes !== undefined) pipeline.notes = notes.trim();
      if (voucherType) pipeline.voucherType = voucherType;
      if (voucherInt !== undefined) pipeline.voucherInt = voucherInt;
      if (PaymentType) pipeline.PaymentType = PaymentType;
      if (Firstpayment !== undefined) pipeline.Firstpayment = Firstpayment;
      if (totalAmount !== undefined) pipeline.totalAmount = totalAmount;
      if (depositAmount !== undefined) pipeline.depositAmount = depositAmount;
      if (surcharge !== undefined) pipeline.surcharge = surcharge;
      if (isBusinessPartner !== undefined) {
        pipeline.isBusinessPartner = (isBusinessPartner === true || isBusinessPartner === "true");
      }
      
      if (products && Array.isArray(products)) {
        pipeline.products = products;
      }
      
      if (K && Array.isArray(K)) {
        pipeline.K = K;
      }

      if (expectedCloseDate) {
        pipeline.expectedCloseDate = new Date(expectedCloseDate);
      }

      // Handle Installments
      if (PaymentType === "Install") {
        if (paymentPlans && Array.isArray(paymentPlans) && paymentPlans.length > 0) {
          let installmentsArray = [];
          for (let i = 0; i < paymentPlans.length; i++) {
            const plan = paymentPlans[i];
            installmentsArray.push({
              installmentNumber: i + 1,
              amount: Number(plan.amountDue),
              expectedDate: new Date(plan.dueDate),
              isPaid: false
            });
          }
          pipeline.installments = installmentsArray;
          
          // Update InstallmentPlan collection
          await InstallmentPlan.deleteMany({ orderCode: pipeline.orderCode });
          let cumulativePaid = 0;
          const plans = paymentPlans.map((plan, index) => {
            const remainAmount = Number(amountTotal) - cumulativePaid;
            cumulativePaid += Number(plan.amountDue);
            return {
              orderCode: pipeline.orderCode,
              TotalAmount: Number(amountTotal),
              PaidAmount: Number(plan.amountDue),
              RemainAmount: remainAmount,
              NoOfPayment: paymentPlans.length,
              dueDate: new Date(plan.dueDate),
              Status: "pending",
              installmentNumber: `Lần ${index + 1}`,
            };
          });
          await InstallmentPlan.insertMany(plans);
        }
      } else if (PaymentType === "Full") {
        pipeline.installments = [];
        await InstallmentPlan.deleteMany({ orderCode: pipeline.orderCode });
      }

      const savedPipeline = await pipeline.save();

      await ActionLog.create({
        entityId: savedPipeline._id,
        entity: "Pipeline",
        action: "UPDATE",
        oldValue: oldPipeline,
        newValue: savedPipeline,
        createdBy: createdBy || pipeline.createdBy,
      });

      // Email notifications
      if (stage !== oldPipeline.stage && (stage === 'Chốt Deal' || stage === 'Hoàn tất thu tiền')) {
        await sendCustomerRegistrationEmail(savedPipeline);
      } else if (PaymentType === "Install" && oldPipeline.PaymentType !== "Install") {
        await sendCustomerRegistrationEmail(savedPipeline);
        await sendInstallmentNotificationToAccountant(savedPipeline);
      }

      res.status(200).json({
        message: "Pipeline has been updated successfully!",
        pipeline: savedPipeline,
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

exports.uploadImage = (req, res) => {
  const { pipelineId } = req.params;

  // Xử lý upload ảnh
  upload(req, res, async (err) => {
    if (err && err.message !== "Unexpected field") {
      return res
        .status(400)
        .json({ message: "Error uploading image", error: err.message });
    }

    try {
      const pipeline = await Pipeline.findById(pipelineId);

      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline không tồn tại" });
      }

      // Xử lý ảnh upload (nếu có), nếu không có ảnh thì để mảng rỗng
      const newImage = req.file
        ? {
          url: `/uploads/${req.file.filename}`, // Đường dẫn URL để truy cập ảnh
          filename: req.file.filename, // Tên file ảnh
        }
        : null; // Nếu không có ảnh thì không thay đổi

      // Nếu có ảnh mới, thêm ảnh mới vào mảng images cũ
      if (newImage) {
        pipeline.images.push(newImage);
      }

      // Lưu Pipeline vào cơ sở dữ liệu
      const updatedPipeline = await pipeline.save();

      // Trả về phản hồi
      res.status(200).json({
        message: "Ảnh đã được upload thành công!",
        filename: req.file.filename, // Trả về tên file mới
        pipeline: updatedPipeline,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error!", error: err.message });
    }
  });
};

exports.addNoteToPipeline = async (req, res) => {
  const { orderCode, content, userId } = req.body;

  try {
    const pipeline = await Pipeline.findOne({ orderCode });
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline không tồn tại." });
    }

    const newNote = await Note.create({
      orderCode,
      content,
      createdBy: userId,
    });

    return res
      .status(201)
      .json({ message: "Ghi chú đã được thêm.", data: newNote });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Lỗi khi thêm ghi chú." });
  }
};

exports.editNote = async (req, res) => {
  const { noteId } = req.params;
  const { content, userId } = req.body;
  try {
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ message: "Ghi chú không tồn tại." });
    if (String(note.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Bạn không có quyền sửa ghi chú này." });
    }
    note.content = content;
    await note.save();
    return res.status(200).json({ message: "Đã cập nhật ghi chú.", data: note });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật ghi chú." });
  }
};

exports.deleteNote = async (req, res) => {
  const { noteId } = req.params;
  const { userId } = req.body;
  try {
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ message: "Ghi chú không tồn tại." });
    if (String(note.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Bạn không có quyền xóa ghi chú này." });
    }
    await note.deleteOne();
    return res.status(200).json({ message: "Đã xóa ghi chú." });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Lỗi khi xóa ghi chú." });
  }
};
exports.getPipelinesrole = async (req, res) => {
  try {
    const userId = req.query.user_id;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Lấy thông tin người dùng và role
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const userEmail = user.email;
    const userPhone = user.profileDetails?.phone;
    const userFullName = `${user.firstname} ${user.lastname}`;

    // Điều kiện lọc theo ngày
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    } else {
      dateFilter.createdAt = {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        $lte: new Date(),
      };
    }

    // Hàm kiểm tra trùng khớp với AffiliateReport
    const findAffiliateMatch = async (contact) => {
      try {
        // Chỉ kiểm tra các trường nếu chúng không phải là null hoặc rỗng
        const conditions = [];
        if (contact?.name) conditions.push({ full_name: contact.name });
        if (contact?.email) conditions.push({ email: contact.email });
        if (contact?.phone) conditions.push({ phone: contact.phone });

        // Nếu không có trường nào hợp lệ, trả về null
        if (conditions.length === 0) {
          return { affiliate_id: null, affiliate_name: null };
        }

        // Tìm bản ghi AffiliateReport khớp với name, email, hoặc phone
        const affiliate = await AffiliateReport.findOne({
          $or: conditions,
        })
          .sort({ datetime: -1 }) // Lấy bản ghi mới nhất
          .select("affiliate_id affiliate_name");

        return affiliate
          ? {
            affiliate_id: affiliate.affiliate_id,
            affiliate_name: affiliate.affiliate_name,
          }
          : { affiliate_id: null, affiliate_name: null };
      } catch (error) {
        console.error(
          `Lỗi khi kiểm tra AffiliateReport cho liên hệ ${contact?._id || "unknown"
          }:`,
          error
        );
        return { affiliate_id: null, affiliate_name: null };
      }
    };

    let pipelines = [];
    if (role === "Admin" || role === "KTT Sale Manager") {
      pipelines = await Pipeline.find({ ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price category")
        .sort({ orderCode: -1 });
    } else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team
        ? team.members.map((member) => member._id)
        : [];
      const allIds = [...teamMemberIds, userId];

      pipelines = await Pipeline.find({
        createdBy: { $in: allIds },
        ...dateFilter,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price category")
        .sort({ orderCode: -1 });
    } else if (role === "KTT User") {
      pipelines = await Pipeline.find({ createdBy: userId, ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price category")
        .sort({ orderCode: -1 });
    } else if (role === "KTT Partner") {
      pipelines = await Pipeline.find({ createdBy: userId, ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price category")
        .sort({ orderCode: -1 });
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách orderCode từ pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Lấy InstallmentPlan liên quan
    const installmentPlans = await InstallmentPlan.find({
      orderCode: { $in: orderCodes },
    }).select(
      "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
    );

    // Lấy notes liên quan
    const notesFromTable = await Note.find({ orderCode: { $in: orderCodes } })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "firstname lastname");

    // Gắn dữ liệu affiliate, installmentPlans, và notes vào từng pipeline
    const result = await Promise.all(
      pipelines.map(async (pipeline) => {
        const affiliateData = await findAffiliateMatch(pipeline.contact);
        const relatedNotesFromTable = notesFromTable.filter(
          (note) => note.orderCode === pipeline.orderCode
        );
        const relatedPlans = installmentPlans.filter(
          (plan) => plan.orderCode === pipeline.orderCode
        );

        const isEmailMatch = pipeline.contact?.email === userEmail;
        const isPhoneMatch = pipeline.contact?.phone === userPhone;
        const isNameMatch = pipeline.contact?.name === userFullName;
        const isContactMatch = isEmailMatch || isPhoneMatch || isNameMatch;

        return {
          ...pipeline.toObject(),
          affiliate_id: affiliateData.affiliate_id,
          affiliate_name: affiliateData.affiliate_name,
          installmentPlans: relatedPlans,
          pipelineNotes: pipeline.notes || [],
          externalNotes: relatedNotesFromTable,
          isContactMatch: isContactMatch,
        };
      })
    );

    return res.status(200).json({ pipelines: result });
  } catch (error) {
    console.error("Lỗi trong API getPipelinesrole:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
exports.getPipelinesroles = async (req, res) => {
  try {
    const userId = req.query.user_id;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Lấy thông tin người dùng và role
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const userEmail = user.email;
    const userPhone = user.profileDetails?.phone;
    const userFullName = `${user.firstname} ${user.lastname}`;

    // Điều kiện lọc theo ngày và trạng thái
    const dateFilter = { status: "Completed" }; // Thêm điều kiện status: Completed
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    let pipelines = [];
    if (role === "Admin" || role === "KTT Sale Manager") {
      pipelines = await Pipeline.find({ ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team
        ? team.members.map((member) => member._id)
        : [];
      const allIds = [...teamMemberIds, userId];

      pipelines = await Pipeline.find({
        createdBy: { $in: allIds },
        ...dateFilter,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT User") {
      pipelines = await Pipeline.find({ createdBy: userId, ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT Partner") {
      pipelines = await Pipeline.find({ createdBy: userId, ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách orderCode từ pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Lấy InstallmentPlan liên quan
    const installmentPlans = await InstallmentPlan.find({
      orderCode: { $in: orderCodes },
    }).select(
      "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
    );

    // Lấy notes liên quan
    const notesFromTable = await Note.find({ orderCode: { $in: orderCodes } })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "firstname lastname");

    // Gắn dữ liệu vào từng pipeline
    const result = pipelines.map((pipeline) => {
      const relatedNotesFromTable = notesFromTable.filter(
        (note) => note.orderCode === pipeline.orderCode
      );
      const relatedPlans = installmentPlans.filter(
        (plan) => plan.orderCode === pipeline.orderCode
      );

      const isEmailMatch = pipeline.contact?.email === userEmail;
      const isPhoneMatch = pipeline.contact?.phone === userPhone;
      const isNameMatch = pipeline.contact?.name === userFullName;
      const isContactMatch = isEmailMatch || isPhoneMatch || isNameMatch;

      return {
        ...pipeline.toObject(),
        installmentPlans: relatedPlans,
        pipelineNotes: pipeline.notes,
        externalNotes: relatedNotesFromTable,
        isContactMatch: isContactMatch,
      };
    });

    return res.status(200).json({ pipelines: result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
exports.getPipelinesByCreator = async (req, res) => {
  try {
    const { createdBy } = req.params; // Lấy `createdBy` từ params

    if (!createdBy) {
      return res
        .status(400)
        .json({ message: "createdBy không được để trống." });
    }

    // Truy vấn tất cả các pipeline do người dùng này tạo, không phân biệt trạng thái
    const pipelines = await Pipeline.find({
      createdBy,
    })
      .populate("user", "name email") // Lấy thông tin user liên kết
      .populate("contact", "name phone") // Lấy thông tin contact liên kết
      .populate("products", "name price") // Lấy thông tin sản phẩm liên kết
      .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo, mới nhất trước

    // Lấy tất cả các orderCode trong pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Truy vấn tất cả InstallmentPlan có orderCode tương ứng
    const installmentPlans = await InstallmentPlan.find({
      orderCode: { $in: orderCodes }, // Lấy các InstallmentPlan có orderCode nằm trong danh sách
    }).select(
      "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
    );

    // Truy vấn tất cả các ghi chú (notes) cho từng orderCode
    const notes = await Note.find({
      orderCode: { $in: orderCodes }, // Lấy các Note có orderCode nằm trong danh sách
    })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "lastname firstname ");

    // Thêm thông tin InstallmentPlan và Note vào từng Pipeline
    const result = pipelines.map((pipeline) => {
      // Lấy các InstallmentPlan cho từng orderCode của pipeline
      const relatedPlans = installmentPlans.filter(
        (plan) => plan.orderCode === pipeline.orderCode
      );

      // Lấy các ghi chú cho từng orderCode của pipeline
      const relatedNotes = notes.filter(
        (note) => note.orderCode === pipeline.orderCode
      );

      return {
        ...pipeline.toObject(),
        installmentPlans: relatedPlans, // Thêm các InstallmentPlan vào pipeline
        note: relatedNotes, // Thêm các ghi chú vào pipeline
      };
    });

    // Trả về kết quả
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi khi lấy pipelines:", error);
    return res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy pipelines.",
      error: error.message,
    });
  }
};
exports.getPipelinesByAff = async (req, res) => {
  try {
    const { createdBy } = req.params; // Lấy `createdBy` từ params
    const { start_date, end_date } = req.query; // Lấy `start_date` và `end_date` từ query

    // Kiểm tra xem createdBy có phải là ObjectId hợp lệ không
    if (!createdBy || !/^[0-9a-fA-F]{24}$/.test(createdBy)) {
      return res.status(400).json({ message: "createdBy không hợp lệ." });
    }

    // Tạo bộ lọc ngày
    const dateFilter = {};
    if (start_date) {
      dateFilter.createdAt = { $gte: new Date(start_date) };
    }
    if (end_date) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        $lte: new Date(end_date),
      };
    }

    // Truy vấn các pipeline do người dùng này tạo, áp dụng bộ lọc ngày
    const pipelines = await model("Pipeline")
      .find({
        createdBy,
        ...dateFilter,
      })
      .populate("user", "name email")
      .populate("contact", "name phone email")
      .populate("products", "name price")
      .sort({ createdAt: -1 });

    // Lấy tất cả các orderCode trong pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Truy vấn tất cả InstallmentPlan có orderCode tương ứng
    const installmentPlans = await model("InstallmentPlan")
      .find({
        orderCode: { $in: orderCodes },
      })
      .select(
        "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
      );

    // Truy vấn tất cả các ghi chú (notes) cho từng orderCode
    const notes = await model("Note")
      .find({
        orderCode: { $in: orderCodes },
      })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "lastname firstname");

    // Tối ưu hóa: Lấy danh sách email và phone từ pipelines để truy vấn AffiliateReport
    const contactEmails = pipelines
      .filter((p) => p.contact?.email)
      .map((p) => p.contact.email);
    const contactPhones = pipelines
      .filter((p) => p.contact?.phone)
      .map((p) => p.contact.phone);

    // Truy vấn AffiliateReport chỉ cho các email hoặc phone liên quan
    const affiliateReports = await model("AffiliateReport").find({
      $or: [
        { email: { $in: contactEmails } },
        { phone: { $in: contactPhones } },
      ],
    });

    // Thêm thông tin InstallmentPlan, Note, và AffiliateReport vào từng Pipeline
    const result = await Promise.all(
      pipelines.map(async (pipeline) => {
        const relatedPlans = installmentPlans.filter(
          (plan) => plan.orderCode === pipeline.orderCode
        );
        const relatedNotes = notes.filter(
          (note) => note.orderCode === pipeline.orderCode
        );

        // Kiểm tra email hoặc phone trong AffiliateReport cho mọi pipeline
        let affiliateInfo = { affiliate_id: null, affiliate_name: null };
        if (pipeline.contact) {
          const contactEmail = pipeline.contact.email;
          const contactPhone = pipeline.contact.phone;

          // Tìm AffiliateReport khớp với email hoặc phone
          const matchedReport = affiliateReports.find(
            (report) =>
              (contactEmail && report.email === contactEmail) ||
              (contactPhone && report.phone === contactPhone)
          );

          if (matchedReport) {
            affiliateInfo = {
              affiliate_id: matchedReport.affiliate_id,
              affiliate_name: matchedReport.affiliate_name,
            };
          }
        }

        return {
          ...pipeline.toObject(),
          installmentPlans: relatedPlans,
          note: relatedNotes,
          affiliateInfo,
        };
      })
    );

    // Lọc kết quả để chỉ giữ các pipeline có affiliateInfo hợp lệ
    const filteredResult = result.filter(
      (pipeline) =>
        pipeline.affiliateInfo && pipeline.affiliateInfo.affiliate_id
    );

    // Trả về kết quả
    return res.status(200).json(filteredResult);
  } catch (error) {
    console.error("Lỗi khi lấy pipelines:", error);
    return res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy pipelines.",
      error: error.message,
    });
  }
};

exports.getAllPipelines = async (req, res) => {
  try {
    // Lấy tất cả các pipeline
    const pipelines = await Pipeline.find()
      .populate("createdBy", "lastname firstname email") // Lấy thông tin user liên kết
      .populate("contact", "name phone") // Lấy thông tin contact liên kết
      .populate("products", "name price") // Lấy thông tin sản phẩm liên kết
      .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo, mới nhất trước

    // Trả về kết quả
    return res.status(200).json(pipelines);
  } catch (error) {
    console.error("Lỗi khi lấy tất cả đơn hàng:", error);
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tất cả đơn hàng." });
  }
};


// KH VIP 
const normalize = (s) => (s || "").trim().toLowerCase();

async function sendCompletionEmail(
  email, customerName, productNames, amountTotal, orderId, categories
) {
  const hasAcademy = categories.some((c) => normalize(c) === normalize("Academy"));
  const hasHub = categories.some((c) => normalize(c) === normalize("Health Hub"));

  console.log(`Gửi email → ${email} | categories: ${JSON.stringify(categories)} | Academy: ${hasAcademy} | Hub: ${hasHub}`);

  if (hasAcademy) {
    await sendAcademyCompletionEmail(email, customerName, productNames, amountTotal, orderId);
  }

  if (hasHub) {
    await sendHubCompletionEmail(email, customerName, productNames, amountTotal, orderId);
  }

  if (!hasAcademy && !hasHub) {
    console.warn(`⚠️ Không xác định category để gửi email cho pipeline ${orderId}. Categories nhận được: ${JSON.stringify(categories)}`);
  }
}

function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "tech@khitamtherapy.com",
      pass: "gHyK2h$xU3VL",
    },
  });
}

function formatDate() {
  return new Date().toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatAmount(amount) {
  return typeof amount === "number"
    ? amount.toLocaleString("vi-VN")
    : amount;
}

function formatProducts(productNames) {
  return Array.isArray(productNames) ? productNames.join(", ") : productNames;
}

async function sendAcademyCompletionEmail(
  email, customerName, productNames, amountTotal, orderId
) {
  const transporter = createTransporter();

  const mailOptions = {
    from: "tech@khitamtherapy.com",
    to: email,
    cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
    subject: `Xác nhận thanh toán thành công - Khóa học ${productNames}`,
    text: `Kính gửi Quý học viên ${customerName},

Chúng tôi xin vui mừng xác nhận rằng thanh toán của Quý học viên đã được nhận thành công.

Thông tin thanh toán:
- Dịch vụ: Khóa học ${formatProducts(productNames)}
- Giá trị thanh toán: ${formatAmount(amountTotal)} VND
- Mã đơn hàng: ${orderId}
- Ngày giao dịch: ${formatDate()}
- Phương thức thanh toán: Chuyển khoản ngân hàng

Quý học viên đã chính thức trở thành học viên của Học viện Khí Tâm trị liệu quốc tế. Chúng tôi rất vinh dự được đồng hành cùng Quý học viên trên hành trình học tập và phát triển bản thân.

Chúng tôi cam kết sẽ hỗ trợ Quý học viên một cách tốt nhất trong suốt quá trình học tập.

_____________________________________________________________________________________

Nếu Quý học viên cần bất kỳ hỗ trợ nào, vui lòng liên hệ qua các kênh sau:
- Ban Điều hành:
  Nhà sáng lập: nguyenthithanhdiem2806@gmail.com
  CEO Mrs Thanh Yên: thanhyen.bui@khitamtherapy.com
- Team hỗ trợ chuyên môn/đào tạo: academy@khitamtherapy.com
  Mr. Trường Xuân: (+84) 975 077 201
- Team hỗ trợ kỹ thuật IT: tech@khitamtherapy.com
  Mr. Trung Tín: (+84) 913 306 193
  Mr. Nguyễn Xuân Đức: (+84) 70 881 7979

Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý học viên.

Chúc Quý học viên mạnh khỏe, bình an và gặt hái nhiều thành công trên hành trình học tập tại Khí Tâm Academy International.

Trân trọng kính chào,
Học viện Khí Tâm Trị liệu Quốc tế
Academy Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ [ACADEMY] Email → ${email}`);
  } catch (error) {
    console.error("❌ Lỗi gửi email Academy:", error);
    throw error;
  }
}

async function sendInstallmentThankYouEmail(email, customerName, productNames, firstPayment, nextInstallment, orderId) {
  const transporter = createTransporter();

  let nextInfoHtml = "";
  if (nextInstallment) {
    nextInfoHtml = `
      <div style="background:#fffbeb; padding:15px; border-radius:6px; margin:15px 0; border:1px solid #fef3c7;">
        <h3 style="margin-top:0; color:#92400e;">🗓️ Thông tin kỳ thanh toán tiếp theo</h3>
        <p style="margin:5px 0;"><strong>Số tiền:</strong> <span style="color:#b45309; font-size:16px;">${nextInstallment.amount.toLocaleString('vi-VN')} VND</span></p>
        <p style="margin:5px 0;"><strong>Hạn thanh toán:</strong> ${new Date(nextInstallment.expectedDate).toLocaleDateString('vi-VN')}</p>
      </div>
    `;
  }

  const mailOptions = {
    from: '"Học Viện Khí Tâm Trị Liệu" <tech@khitamtherapy.com>',
    to: email,
    cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
    subject: `[Xác nhận] Thanh toán trả góp đợt đầu - Khóa học ${productNames}`,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e0e0e0; border-radius:8px;">
        <div style="text-align:center; padding-bottom:20px;">
          <h2 style="color:#054a27; margin:0;">Cảm ơn Quý học viên!</h2>
          <p style="color:#666;">Học viện đã nhận được thanh toán của bạn</p>
        </div>
        
        <p>Chào <strong>${customerName}</strong>,</p>
        <p>Học viện Khí Tâm Trị Liệu Quốc Tế xác nhận đã nhận khoản thanh toán đầu tiên cho khóa học <strong>${productNames}</strong>.</p>
        
        <div style="background:#f3f4f6; padding:15px; border-radius:6px; margin:15px 0;">
          <p style="margin:5px 0;"><strong>Mã đơn hàng:</strong> #${orderId}</p>
          <p style="margin:5px 0;"><strong>Số tiền đã nhận:</strong> ${firstPayment.toLocaleString('vi-VN')} VND</p>
          <p style="margin:5px 0;"><strong>Ngày xác nhận:</strong> ${new Date().toLocaleDateString('vi-VN')}</p>
        </div>

        ${nextInfoHtml}

        <div style="background:#e8f5e9; padding:15px; border-radius:6px; margin:15px 0;">
          <h3 style="margin-top:0; color:#054a27;">💳 Thông tin chuyển khoản các kỳ sau</h3>
          <p style="margin:5px 0;">Tên tài khoản: <strong>CTCP KHI TAM CONG NGHE SUC KHOE VN</strong></p>
          <p style="margin:5px 0;">Số tài khoản: <strong>1037757201</strong></p>
          <p style="margin:5px 0;">Ngân hàng: <strong>Vietcombank</strong></p>
          <p style="margin:5px 0;">Nội dung: <strong>Họ tên - #${orderId}</strong></p>
        </div>

        <p style="font-size:13px; color:#666;">Vui lòng hoàn tất thanh toán các kỳ tiếp theo đúng hạn để duy trì quyền truy cập vào tài liệu học tập và các buổi học trực tuyến.</p>
        
        <p>Trân trọng,<br/>
        <strong>Học Viện Khí Tâm Trị Liệu Quốc Tế</strong></p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ [INSTALLMENT_THANKYOU] Email → ${email}`);
  } catch (error) {
    console.error("❌ Lỗi gửi email cảm ơn trả góp:", error);
  }
}

async function sendHubCompletionEmail(
  email, customerName, productNames, amountTotal, orderId
) {
  const transporter = createTransporter();

  const mailOptions = {
    from: "tech@khitamtherapy.com",
    to: email,
    cc: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, ketoannoibodtp2025@gmail.com, nguyenthithanhdiem2806@gmail.com, khitamtherapytech@gmail.com',
    subject: `Xác nhận thanh toán thành công - Dịch vụ ${productNames}`,
    text: `Kính gửi Quý khách hàng ${customerName},

Chúng tôi xin vui mừng xác nhận rằng thanh toán của Quý khách đã được nhận thành công.

Thông tin thanh toán:
- Dịch vụ: Dịch vụ Khí Tâm Hub - ${formatProducts(productNames)}
- Giá trị thanh toán: ${formatAmount(amountTotal)} VNĐ
- Mã đơn hàng: ${orderId}
- Ngày giao dịch: ${formatDate()}
- Phương thức thanh toán: Chuyển khoản ngân hàng

Quý khách đã chính thức trở thành khách hàng của Khí Tâm Hub. Chúng tôi rất vinh dự được đồng hành cùng Quý khách trong lộ trình chăm sóc và cải thiện sức khỏe toàn diện.

Đội ngũ Khí Tâm Hub cam kết hỗ trợ Quý khách một cách chu đáo và chuyên nghiệp nhất, đặc biệt trong việc tư vấn, đo khám, thiết kế và giao đế giày chỉnh hình cá nhân hóa (nếu có; đây là sản phẩm bổ trợ nhằm đảm bảo mục tiêu của lộ trình chăm sóc sức khỏe được tối ưu và hiệu quả cao hơn).

_____________________________________________________________________________________

Nếu Quý khách cần bất kỳ hỗ trợ nào, vui lòng liên hệ ngay qua các kênh sau:
- Ban Điều hành:
  Nhà sáng lập Master Sridevi Tố Hải: yogathienwithme@gmail.com
  CEO Mrs Thanh Yên: thanhyen.bui@khitamtherapy.com
- Chăm sóc khách hàng: Hotline 0349635168 - consultant.training@khitamtherapy.com
- Team hỗ trợ kỹ thuật & Đơn hàng: tech@khitamtherapy.com
  Mr. Trung Tín: (+84) 913 306 193
  Mr. Nguyễn Xuân Đức: (+84) 70 881 7979

Một lần nữa, xin chân thành cảm ơn sự tin tưởng của Quý khách dành cho Khí Tâm Hub.

Chúc Quý khách sức khỏe dồi dào, bình an và đạt được những cải thiện rõ rệt trên hành trình đồng hành cùng chúng tôi.

Trân trọng kính chào,
Khí Tâm Hub Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ [HUB] Email → ${email}`);
  } catch (error) {
    console.error("❌ Lỗi gửi email Hub:", error);
    throw error;
  }
}

// async function sendCompletionEmail(
//   email,
//   customerName,
//   productNames,
//   amountTotal,
//   orderId,
//   transactionDate,
//   paymentMethod = "Chuyển khoản ngân hàng"
// ) {
//   const transporter = nodemailer.createTransport({
//     host: "smtp.office365.com",
//     port: 587,
//     secure: false,
//     auth: {
//       user: "tech@khitamtherapy.com",
//       pass: "gHyK2h$xU3VL",
//     },
//   });

//   const mailOptions = {
//     from: "tech@khitamtherapy.com",
//     to: email,
//     cc: "consultant.training@khitamtherapy.com",
//     subject: "Chào Mừng Hội viên VIP - Bạn chính thức là Elite Mastermind Khí Tâm! 🌟",
//     text: `Kính gởi Quý Hội viên ${customerName},

// Từ tận đáy lòng, Master Sridevi Tố Hải và toàn bộ gia đình Khí Tâm Therapy xin gửi lời chào mừng nồng nhiệt nhất đến Bạn - thành viên VIP ELITE MASTERMIND chính thức!

// Hôm nay, Bạn không chỉ là một hội viên.
// Bạn là người được chọn, người đã vượt qua hành trình từ khám phá → chuyên nghiệp → và giờ đây bước vào cấp độ cao nhất của Hệ sinh thái Khí Tâm: nơi Chúng ta cùng nhau xây dựng sự nghiệp thành công bền vững và thịnh vượng, sống đúng sứ mệnh chữa lành và lan tỏa năng lượng.

// Cảm ơn Bạn vì đã tin tưởng và đầu tư mạnh mẽ vào chính bản thân mình. Đây là bước ngoặt quan trọng - và Chúng tôi cam kết đồng hành cùng bạn từng bước một.

// Dưới đây là những gì bạn nhận được:

// 1. Mentorship trực tiếp cùng Master Sridevi
//    1. 2 giờ 1:1/tháng (lịch cố định hàng tháng - bạn sẽ nhận lịch chi tiết trong email riêng).

// 2. Bộ công cụ "Khí Tâm Business System" - Chìa khóa trao tay

// 3. Thư viện The Vault VIP Only

// 4. Đặc quyền bảo chứng & marketing
//    1. Huy hiệu "Elite Practitioner" (verified được xác nhận trực tiếp bởi Master) – cập nhật profile website Khí Tâm & page cá nhân.

// 5. Ưu đãi hệ sinh thái độc quyền - 10% ưu đãi cho các dịch vụ:
//    1. dịch vụ tư vấn thăm khám Hub (trực tiếp cùng Master) cho bạn & gia đình; Đế dép chỉnh hình cá nhân hóa và vé VIP Retreats cùng Founder.

// _____________________________________________________________________________________
// Chúng tôi trân trọng sự đồng hành và đầu tư của Bạn vào hành trình trở thành Master thực thụ.

// Hành động tiếp theo ngay hôm nay (để nhận năng lượng mạnh mẽ nhất):

// * Hãy bắt đầu Hành trình xây dựng sự nghiệp trị liệu thịnh vượng bằng cách điền thông tin vào Form "ĐĂNG KÝ ĐỒNG HÀNH & PHÁT TRIỂN SỰ NGHIỆP CÙNG MASTER SRIDEVI TỐ HẢI (VIP ELITE)" tại đây: https://crmkhitam.com/eliteMastermind

// * Trả lời email này: "Tôi sẵn sàng!" + chia sẻ 1 case khó đang gặp hoặc mục tiêu sự nghiệp 2026 để Master Sridevi Tố Hải ưu tiên hỗ trợ đầu tiên.

// Bạn không cô đơn trên hành trình này nữa. Chúng ta là Elite Family – cùng chữa lành, cùng thịnh vượng, cùng lan tỏa.

// Với tất cả tình yêu và năng lượng cao nhất,

// Master Sridevi Tố Hải
// Nhà sáng lập Khí Tâm Trị Liệu & Đội ngũ Elite Support

// P/S:
// * Trong 48h tới, bạn sẽ nhận email lịch Mentorship cá nhân hóa + lời mời "Trực chiến" đầu tiên. Hãy kiểm tra hộp thư (và spam) nhé!
// * Nhằm bảo đảm sự hỗ trợ và đồng hành chuyên nghiệp trong hành trình của Quý Hội viên, đừng ngần ngại liên hệ:
//    * Ban điều hành: Nhà sáng lập nguyenthithanhdiem2806@gmail.com & Mrs Thanh Yên thanhyen.bui@khitamtherapy.com
//    * Team hỗ trợ chuyên môn/đào tạo: email academy@khitamtherapy.com - Mr Trường Xuân (+84 975077201) / Mr Vũ Đông (+84 908825893)
//    * Team hỗ trợ kỹ thuật IT: email tech@khitamtherapy.com - Mr Trung Tín (+84-913306193) / Mr Nguyễn Xuân Đức - IT Dev (+84-70 881 7979)`,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log(`✅ Email đã gửi đến ${email}, CC: consultant.training@khitamtherapy.com`);
//   } catch (error) {
//     console.error("❌ Lỗi khi gửi email:", error);
//   }
// }
exports.deletePipeline = async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID từ params
    const { userId } = req.body; // Lấy userId từ body

    // Tìm đơn hàng theo ID
    const pipeline = await Pipeline.findById(id);

    if (!pipeline) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng với ID này.",
      });
    }

    // Kiểm tra trạng thái đơn hàng
    if (pipeline.status !== "Pending" && pipeline.status !== "Cancelled") {
      return res.status(400).json({
        message: "Chỉ có thể xóa đơn hàng ở trạng thái Pending hoặc Cancelled.",
      });
    }

    // Ghi lại ActionLog trước khi xóa
    const actionLog = new ActionLog({
      entityId: pipeline._id,
      entity: "Pipeline",
      action: "DELETE",
      oldValue: pipeline,
      createdBy: userId, // Gán userId từ request
    });

    await actionLog.save(); // Lưu vào bảng ActionLogs

    // Xóa hoàn toàn đơn hàng
    await Pipeline.findByIdAndDelete(id); // Xóa đơn hàng khỏi cơ sở dữ liệu

    return res.status(200).json({
      message: "Xóa đơn hàng thành công.",
    });
  } catch (error) {
    console.error("Lỗi khi xóa đơn hàng:", error); // In lỗi ra console
    return res.status(500).json({
      message: "Có lỗi xảy ra khi xóa đơn hàng.",
    });
  }
};
// exports.updatePipelineStage = async (req, res) => {
//   try {
//     const pipelineId = req.params.id;
//     const newStage = req.body.stage;
//     const createdBy = req.body.createdBy; // Lấy user id từ phía FE

//     // Lấy Pipeline hiện tại
//     const pipeline = await Pipeline.findById(pipelineId);

//     // Nếu không tìm thấy Pipeline
//     if (!pipeline) {
//       return res.status(404).json({ message: "Pipeline not found" });
//     }

//     // Kiểm tra nếu stage có thay đổi
//     if (pipeline.stage !== newStage) {
//       // Ghi lại ActionLog
//       await ActionLog.create({
//         entityId: pipelineId,
//         entity: "Pipeline",
//         action: "UPDATE",
//         oldValue: { stage: pipeline.stage },
//         newValue: { stage: newStage },
//         createdBy: createdBy, // Sử dụng user id từ FE
//       });

//       // Cập nhật stage mới
//       pipeline.stage = newStage;
//       await pipeline.save();
//     }

//     return res
//       .status(200)
//       .json({ message: "Pipeline updated successfully", pipeline });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

exports.getPipelinesroleaca = async (req, res) => {
  try {
    const userId = req.query.user_id; // Lấy user_id từ query parameters
    const startDate = req.query.start_date ? new Date(req.query.start_date) : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;
    const serviceFilter = req.query.service; // Lấy loại dịch vụ cần lọc

    // Kiểm tra userId có tồn tại không
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Tìm người dùng với user_id và populate role
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;

    // Điều kiện lọc theo datetime
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    } else {
      dateFilter.createdAt = {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        $lte: new Date(),
      };
    }

    // Hàm kiểm tra trùng khớp với AffiliateReport
    const findAffiliateMatch = async (contact) => {
      try {
        // Chỉ kiểm tra các trường nếu chúng không phải là null hoặc rỗng
        const conditions = [];
        if (contact?.name) conditions.push({ full_name: contact.name });
        if (contact?.email) conditions.push({ email: contact.email });
        if (contact?.phone) conditions.push({ phone: contact.phone });

        // Nếu không có trường nào hợp lệ, trả về null
        if (conditions.length === 0) {
          return { affiliate_id: null, affiliate_name: null };
        }

        // Tìm bản ghi AffiliateReport khớp với name, email, hoặc phone
        const affiliate = await AffiliateReport.findOne({
          $or: conditions,
        })
          .sort({ datetime: -1 }) // Lấy bản ghi mới nhất
          .select("affiliate_id affiliate_name");

        return affiliate
          ? {
            affiliate_id: affiliate.affiliate_id,
            affiliate_name: affiliate.affiliate_name,
          }
          : { affiliate_id: null, affiliate_name: null };
      } catch (error) {
        console.error(
          `Lỗi khi kiểm tra AffiliateReport cho liên hệ ${contact?._id || "unknown"}:`,
          error
        );
        return { affiliate_id: null, affiliate_name: null };
      }
    };

    let pipelines = [];

    // Lọc theo role và lấy cả đơn "Completed" và "Pending"
    if (role === "Admin" || role === "Cust_service" || role === "KTT Sale Manager") {
      const serviceMatch = serviceFilter
        ? { category: { $in: serviceFilter.split(",") } }
        : {};

      pipelines = await Pipeline.find({
        ...dateFilter,
        status: { $in: ["Completed", "Pending"] },
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: serviceMatch,
        })
        .sort({ orderCode: -1 });
    } else if (role === "Aca_Specialis") {
      pipelines = await Pipeline.find({
        ...dateFilter,
        status: { $in: ["Completed", "Pending"] },
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: { category: "Academy" }, // Chỉ lấy sản phẩm thuộc danh mục "Academy"
        })
        .sort({ orderCode: -1 });

      // Lọc để chỉ giữ pipelines có sản phẩm thuộc danh mục "Academy"
      pipelines = pipelines.filter((pipeline) =>
        pipeline.products.some((product) => product.category === "Academy")
      );
    } else if (role === "Hub Specialist") {
      pipelines = await Pipeline.find({
        ...dateFilter,
        status: { $in: ["Completed", "Pending"] },
      })
        .populate("contact", "name email")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: { category: "Health Hub" }, // Chỉ lấy sản phẩm thuộc danh mục "Health Hub"
        })
        .sort({ orderCode: -1 });

      // Lọc thêm nếu có query filter_health_hub=true
      if (req.query.filter_health_hub === "true") {
        pipelines = pipelines.filter((pipeline) =>
          pipeline.products.some((product) => product.category === "Health Hub")
        );
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách orderCode từ pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Truy vấn các notes từ bảng Note liên quan đến orderCode
    const notesFromTable = await Note.find({
      orderCode: { $in: orderCodes },
    })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "firstname lastname");

    // Thêm affiliate_id, affiliate_name và notes vào mỗi pipeline
    const result = await Promise.all(
      pipelines.map(async (pipeline) => {
        const affiliateData = await findAffiliateMatch(pipeline.contact);
        const relatedNotesFromTable = notesFromTable.filter(
          (note) => note.orderCode === pipeline.orderCode
        );

        return {
          ...pipeline.toObject(),
          affiliate_id: affiliateData.affiliate_id,
          affiliate_name: affiliateData.affiliate_name,
          pipelineNotes: pipeline.notes || [],
          externalNotes: relatedNotesFromTable,
        };
      })
    );

    return res.status(200).json({ pipelines: result });
  } catch (error) {
    console.error("Lỗi trong API getPipelinesroleaca:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// exports.getPipelinesroleaca = async (req, res) => {
//   try {
//     const userId = req.query.user_id; // Lấy user_id từ query parameters
//     const startDate = req.query.start_date
//       ? new Date(req.query.start_date)
//       : null;
//     const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

//     if (!userId) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     // Tìm người dùng với user_id và populate role
//     const user = await User.findById(userId).populate("role");
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const role = user.role.name;

//     // Điều kiện lọc theo datetime
//     const dateFilter = {};
//     if (startDate && endDate) {
//       dateFilter.createdAt = { $gte: startDate, $lte: endDate };
//     }

//     let pipelines = [];

//     // Lọc theo role và lấy cả đơn "Completed" và "Pending"
//     if (
//       role === "Admin" ||
//       role === "Aca_Specialis" ||
//       role === "Cust_service" ||
//       role === "KTT Sale Manager"
//     ) {
//       pipelines = await Pipeline.find({
//         ...dateFilter,
//         status: { $in: ["Completed", "Pending"] },
//       })
//         .populate("contact", "name email phone")
//         .populate({
//           path: "createdBy",
//           select: "firstname lastname role",
//           populate: { path: "role", select: "name" },
//         })
//         .populate("products", "name price category")
//         .sort({ orderCode: -1 });
//     } else if (role === "Hub Specialist") {
//       pipelines = await Pipeline.find({
//         ...dateFilter,
//         status: { $in: ["Completed", "Pending"] },
//       })
//         .populate("contact", "name email")
//         .populate({
//           path: "createdBy",
//           select: "firstname lastname role",
//           populate: { path: "role", select: "name" },
//         })
//         .populate({
//           path: "products",
//           select: "name price category",
//           match: { category: "Health Hub" },
//         })
//         .sort({ orderCode: -1 });

//       // Lọc các pipelines chỉ chứa sản phẩm "Health Hub"
//       if (req.query.filter_health_hub === "true") {
//         pipelines = pipelines.filter((pipeline) =>
//           pipeline.products.some((product) => product.category === "Health Hub")
//         );
//       }
//     } else {
//       return res.status(403).json({ message: "Forbidden" });
//     }

//     // Lấy danh sách orderCode từ pipelines
//     const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

//     // Truy vấn các notes từ bảng Note liên quan đến orderCode
//     const notesFromTable = await Note.find({
//       orderCode: { $in: orderCodes },
//     })
//       .select("orderCode content createdBy createdAt")
//       .populate("createdBy", "firstname lastname");

//     // Gắn notes từ bảng Note và bảng Pipeline vào từng pipeline
//     const result = pipelines.map((pipeline) => {
//       const relatedNotesFromTable = notesFromTable.filter(
//         (note) => note.orderCode === pipeline.orderCode
//       );

//       return {
//         ...pipeline.toObject(),
//         pipelineNotes: pipeline.notes || [], // Notes từ bảng Pipeline
//         externalNotes: relatedNotesFromTable, // Notes từ bảng Note
//       };
//     });

//     return res.status(200).json({ pipelines: result });
//   } catch (error) {
//     console.error(error);
//     return res
//       .status(500)
//       .json({ message: "Server error", error: error.message });
//   }
// };

exports.searchPipelinesByContact = async (req, res) => {
  try {
    const { searchTerm, user_id } = req.body; // Nhận searchTerm và user_id từ request body

    // Kiểm tra hợp lệ đầu vào
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (!searchTerm || typeof searchTerm !== "string") {
      return res
        .status(400)
        .json({ message: "Search term must be a non-empty string" });
    }

    // Lấy thông tin người dùng và vai trò
    const user = await User.findById(user_id).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const sanitizedSearchTerm = searchTerm.trim();

    // Tìm kiếm liên hệ qua email, tên hoặc số điện thoại
    const contact = await Contact.findOne({
      $or: [
        { email: { $regex: sanitizedSearchTerm, $options: "i" } },
        { name: { $regex: sanitizedSearchTerm, $options: "i" } },
        { phone: { $regex: sanitizedSearchTerm, $options: "i" } },
      ],
    });

    if (!contact) {
      return res
        .status(404)
        .json({ message: "No contact found with this information" });
    }

    // Lấy danh sách pipeline liên quan đến liên hệ
    let pipelines = await Pipeline.find({ contact: contact._id })
      .populate("contact", "name email phone")
      .populate({
        path: "createdBy",
        select: "firstname lastname role",
        populate: { path: "role", select: "name" },
      })
      .populate({
        path: "products",
        select: "name price category",
        match: role === "Aca_Specialis" ? { category: "Academy" } :
          role === "Hub Specialist" ? { category: "Health Hub" } : {},
      })
      .sort({ orderCode: -1 });

    // Phân quyền để lọc pipeline
    if (role === "Aca_Specialis") {
      pipelines = pipelines.filter((pipeline) =>
        pipeline.products.some((product) => product.category === "Academy")
      );
    } else if (role === "Hub Specialist") {
      pipelines = pipelines.filter((pipeline) =>
        pipeline.products.some((product) => product.category === "Health Hub")
      );
    } else if (!["Admin", "Cust_service", "KTT Sale Manager"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lọc các pipeline có trạng thái "Completed" hoặc "Pending"
    const filteredPipelines = pipelines.filter(
      (pipeline) => pipeline.status === "Pending" || pipeline.status === "Completed"
    );

    if (filteredPipelines.length === 0) {
      return res
        .status(404)
        .json({ message: "No completed or pending pipelines related to this contact" });
    }

    // Trả về kết quả
    return res.status(200).json({
      message: "Search successful!",
      pipelines: filteredPipelines,
    });
  } catch (error) {
    console.error("Search error:", error); // Ghi log lỗi
    return res.status(500).json({
      message: "An error occurred during the search",
      error: error.message,
    });
  }
};

// Hàm để escape các ký tự đặc biệt trong searchTerm
const escapeRegExp = (str) => {
  return str.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, "\\$&"); // Escape các ký tự đặc biệt
};

exports.searchPipelinesByProductName = async (req, res) => {
  try {
    const { searchTerm, user_id } = req.body;

    // Kiểm tra hợp lệ đầu vào
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!searchTerm || typeof searchTerm !== "string") {
      return res
        .status(400)
        .json({ message: "Search term must be a non-empty string" });
    }

    // Tìm thông tin người dùng và role
    const user = await User.findById(user_id).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const sanitizedSearchTerm = escapeRegExp(searchTerm.trim());

    // Tìm kiếm sản phẩm theo tên
    const product = await Product.findOne({
      name: {
        $regex: new RegExp(sanitizedSearchTerm, "i"),
      },
      // Giới hạn danh mục sản phẩm theo vai trò
      ...(role === "Aca_Specialis" ? { category: "Academy" } :
        role === "Hub Specialist" ? { category: "Health Hub" } : {}),
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let pipelines = [];

    // Lọc pipelines theo vai trò
    if (role === "Admin" || role === "Cust_service" || role === "KTT Sale Manager") {
      pipelines = await Pipeline.find({
        status: { $in: ["Completed", "Pending"] },
        products: product._id,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price category")
        .sort({ orderCode: -1 });
    } else if (role === "Aca_Specialis") {
      pipelines = await Pipeline.find({
        status: { $in: ["Completed", "Pending"] },
        products: product._id,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: { category: "Academy" }, // Chỉ lấy sản phẩm thuộc danh mục "Academy"
        })
        .sort({ orderCode: -1 });

      // Lọc để chỉ giữ pipelines có sản phẩm thuộc danh mục "Academy"
      pipelines = pipelines.filter((pipeline) =>
        pipeline.products.some((product) => product.category === "Academy")
      );
    } else if (role === "Hub Specialist") {
      pipelines = await Pipeline.find({
        status: { $in: ["Completed", "Pending"] },
        products: product._id,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: { category: "Health Hub" }, // Chỉ lấy sản phẩm thuộc danh mục "Health Hub"
        })
        .sort({ orderCode: -1 });

      // Lọc thêm nếu có query filter_health_hub=true
      if (req.query.filter_health_hub === "true") {
        pipelines = pipelines.filter((pipeline) =>
          pipeline.products.some((product) => product.category === "Health Hub")
        );
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (pipelines.length === 0) {
      return res.status(404).json({
        message: "No pipelines found with this product name",
      });
    }

    // Định dạng dữ liệu trả về
    const formattedPipelines = pipelines.map((pipeline) => {
      return {
        _id: pipeline._id,
        contact: pipeline.contact,
        amountTotal: pipeline.amountTotal,
        voucherType: pipeline.voucherType,
        PaymentType: pipeline.PaymentType,
        totalAmount: pipeline.totalAmount,
        expectedCloseDate: pipeline.expectedCloseDate,
        notes: pipeline.notes,
        stage: pipeline.stage,
        createdBy: pipeline.createdBy
          ? {
            _id: pipeline.createdBy._id,
            firstname: pipeline.createdBy.firstname,
            lastname: pipeline.createdBy.lastname,
            role: pipeline.createdBy.role
              ? pipeline.createdBy.role.name
              : null,
          }
          : null,
        products: pipeline.products,
        status: pipeline.status,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
        orderCode: pipeline.orderCode,
        K: pipeline.K || [],
        images: pipeline.images || [],
      };
    });

    return res.status(200).json({
      message: "Search successful!",
      pipelines: formattedPipelines,
    });
  } catch (error) {
    console.error("Error occurred while searching pipelines:", error);
    return res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};