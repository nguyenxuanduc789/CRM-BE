const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const LMSUser = require("../models/lms_user.model");

const JWT_SECRET  = process.env.LMS_JWT_SECRET  || "lms_secret_key_2025";
const JWT_EXPIRES = process.env.LMS_JWT_EXPIRES  || "30d";

// Tạo transporter email dựa theo emailController.js hiện tại
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "tech@khitamtherapy.com",
      pass: process.env.SMTP_PASS || "gHyK2h$xU3VL",
    },
    tls: { rejectUnauthorized: false },
  });

class LMSAuthController {

  // POST /api/lms/auth/login
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu." });

      const user = await LMSUser.findOne({ email });
      if (!user)
        return res.status(401).json({ success: false, message: "Email không tồn tại." });

      if (user.status === "inactive")
        return res.status(403).json({ success: false, message: "Tài khoản đã bị khoá." });

      const isMatch = await user.comparePassword(password);
      if (!isMatch)
        return res.status(401).json({ success: false, message: "Mật khẩu không đúng." });

      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        { _id: user._id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      res.status(200).json({
        success: true,
        message: "Đăng nhập thành công!",
        token,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/lms/auth/register
  static async register(req, res) {
    try {
      const { fullName, email, password, role } = req.body;
      if (!fullName || !email || !password)
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

      const existing = await LMSUser.findOne({ email });
      if (existing)
        return res.status(400).json({ success: false, message: "Email đã được sử dụng." });

      // Chỉ cho phép đăng ký student hoặc trainer, không cho tự đặt admin
      const allowedRoles = ["student", "trainer"];
      const userRole = allowedRoles.includes(role) ? role : "student";

      const user = new LMSUser({ fullName, email, password, role: userRole });
      await user.save();

      const token = jwt.sign(
        { _id: user._id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      res.status(201).json({
        success: true,
        message: "Đăng ký thành công!",
        token,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/lms/auth/logout
  static async logout(req, res) {
    res.status(200).json({ success: true, message: "Đăng xuất thành công." });
  }

  // GET /api/lms/auth/me
  static async me(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(401).json({ success: false, message: "Không có token." });

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await LMSUser.findById(decoded._id).select("-password");
      if (!user)
        return res.status(404).json({ success: false, message: "User không tồn tại." });

      res.status(200).json({ success: true, user });
    } catch (err) {
      res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn." });
    }
  }

  // POST /api/lms/auth/forgot-password
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({ success: false, message: "Vui lòng nhập email." });

      const user = await LMSUser.findOne({ email });
      if (!user)
        return res.status(404).json({ success: false, message: "Email không tồn tại trong hệ thống." });

      // Tạo OTP 6 chữ số
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.resetPasswordOTP = otp;
      user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
      await user.save({ validateBeforeSave: false });

      // Gửi email
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: '"Khitam LMS" <tech@khitamtherapy.com>',
          to: email,
          subject: "Khitam LMS - Mã đặt lại mật khẩu",
          text: `Mã OTP của bạn là: ${otp}. Có hiệu lực trong 15 phút.`,
          html: `<p>Mã OTP của bạn là: <strong>${otp}</strong>. Có hiệu lực trong 15 phút.</p>`,
        });
      } catch (mailErr) {
        console.error("Lỗi gửi email OTP:", mailErr.message);
        // Vẫn trả về thành công để không lộ thông tin nhưng log lỗi
      }

      res.status(200).json({
        success: true,
        message: "OTP đã được gửi vào email của bạn",
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/lms/auth/reset-password
  static async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword)
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

      const user = await LMSUser.findOne({ email });
      if (!user)
        return res.status(404).json({ success: false, message: "Email không tồn tại." });

      if (!user.resetPasswordOTP || user.resetPasswordOTP !== otp)
        return res.status(400).json({ success: false, message: "OTP không hợp lệ." });

      if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date())
        return res.status(400).json({ success: false, message: "OTP đã hết hạn. Vui lòng yêu cầu lại." });

      // Cập nhật mật khẩu (pre-save hook sẽ hash)
      user.password = newPassword;
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(200).json({ success: true, message: "Đặt lại mật khẩu thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /api/lms/auth/profile  (requireAuth)
  static async updateProfile(req, res) {
    try {
      const { fullName, bio, website, title, phone, avatar } = req.body;
      const user = await LMSUser.findByIdAndUpdate(
        req.lmsUser._id,
        { fullName, bio, website, title, phone, avatar },
        { new: true, runValidators: true }
      ).select("-password");

      if (!user)
        return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });

      res.status(200).json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /api/lms/auth/change-password  (requireAuth)
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword)
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

      const user = await LMSUser.findById(req.lmsUser._id);
      if (!user)
        return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch)
        return res.status(401).json({ success: false, message: "Mật khẩu hiện tại không đúng." });

      user.password = newPassword;
      await user.save();

      res.status(200).json({ success: true, message: "Đổi mật khẩu thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/lms/admin/users  (Admin: xem danh sách toàn bộ users LMS)
  static async listUsers(req, res) {
    try {
      const users = await LMSUser.find({}).select("-password").sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /api/lms/admin/users  (Admin: tạo user mới)
  static async createUser(req, res) {
    try {
      const { fullName, email, password, role, phone } = req.body;
      const existing = await LMSUser.findOne({ email });
      if (existing)
        return res.status(400).json({ success: false, message: "Email đã tồn tại." });

      const user = new LMSUser({ fullName, email, password, role: role || "student", phone });
      await user.save();

      const { password: _, ...safe } = user.toObject();
      res.status(201).json({ success: true, data: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

// Middleware xác thực token LMS
LMSAuthController.requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ success: false, message: "Chưa đăng nhập." });

    const token = authHeader.split(" ")[1];
    req.lmsUser = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Token không hợp lệ." });
  }
};

// Middleware kiểm tra role
LMSAuthController.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.lmsUser?.role))
    return res.status(403).json({ success: false, message: "Không có quyền truy cập." });
  next();
};

module.exports = LMSAuthController;
