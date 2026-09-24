const RishikeshSubmission = require("../models/rishikesh_submission.model");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tech@khitamtherapy.com',
    pass: 'gHyK2h$xU3VL',
  },
});

class RishikeshSubmissionController {
  // Tạo mới 1 submission (dùng cho webhook)
  static async createSubmission(req, res) {
    try {
      const payload = req.body;
      
      // Map data từ form nếu data gửi dạng webhook 
      // Hoặc nếu gửi chuẩn theo model
      const newSubmission = new RishikeshSubmission(payload);
      const savedSubmission = await newSubmission.save();

      // Send notification email
      try {
        const mailOptions = {
          from: '"CRM System" <tech@khitamtherapy.com>',
          to: 'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, nguyenthithanhdiem2806@gmail.com',
          subject: '[CRM] CÓ FORM RISHIKESH MỚI - YÊU CẦU KIỂM TRA',
          html: `
            <h3>Xin chào team Sale,</h3>
            <p>Vừa có một khách hàng mới điền thông tin đăng ký form Rishikesh.</p>
            <p>Vui lòng lên hệ thống CRM để kiểm tra thông tin chi tiết.</p>
            <br>
            <b>Thông tin khách hàng:</b>
            <ul>
              <li><b>Họ và tên:</b> ${payload.fullName || 'Chưa cung cấp'}</li>
              <li><b>Số điện thoại:</b> ${payload.phoneNumber || 'Chưa cung cấp'}</li>
              <li><b>Email:</b> ${payload.email || 'Chưa cung cấp'}</li>
            </ul>
            <br>
            <p>Cảm ơn,</p>
            <p>Hệ thống tự động CRM Khí Tâm</p>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log("Sent notification email for new Rishikesh submission");
      } catch (err) {
        console.error("Error sending Rishikesh notification email:", err);
      }

      
      return res.status(201).json({
        message: "Created submission successfully",
        data: savedSubmission
      });
    } catch (error) {
      console.error("Create Rishikesh Submission Error:", error);
      return res.status(500).json({
        message: "Internal server error",
        error: error.message
      });
    }
  }

  // Lấy danh sách submission
  static async getSubmissions(req, res) {
    try {
      const submissions = await RishikeshSubmission.find().sort({ createdAt: -1 });
      return res.status(200).json({
        message: "Get submissions successfully",
        data: submissions
      });
    } catch (error) {
      console.error("Get Rishikesh Submissions Error:", error);
      return res.status(500).json({
        message: "Internal server error",
        error: error.message
      });
    }
  }
}

module.exports = RishikeshSubmissionController;
