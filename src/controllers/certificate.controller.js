const Certificate = require('../models/certificate.model');
const CertificateAdmin = require('../models/certificateAdmin.model');
const Otp = require('../models/otp.model');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const {
  ensureCertificateAdmins,
  DEFAULT_ADMIN_EMAILS,
} = require('../utils/ensureCertificateAdmins');
const axios = require('axios');

// Secret key for JWT (should ideally be in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'khitam_secret_key_2026';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const isAdminEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (DEFAULT_ADMIN_EMAILS.includes(normalized)) return true;
  await ensureCertificateAdmins();
  const admin = await CertificateAdmin.findOne({
    email: normalized,
    role: 'admin',
    active: true,
  });
  return !!admin;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseIssueDateFields = (value) => {
  if (!value) return { courseRange: null, issuedOn: null };
  const str = String(value);
  const issuedMatch = str.match(/Issued on:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const rangeMatch = str.match(
    /Course from\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*to\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (issuedMatch || rangeMatch) {
    return {
      courseRange: rangeMatch ? `${rangeMatch[1]} → ${rangeMatch[2]}` : null,
      issuedOn: issuedMatch ? issuedMatch[1] : null,
    };
  }
  return { courseRange: null, issuedOn: str };
};

/** Chỉ tên/số chứng chỉ + ngày cấp — dùng cho tra cứu không phải admin */
const toLimitedCertificate = (cert) => {
  const { issuedOn } = parseIssueDateFields(cert.issueDate);
  return {
    _id: cert._id,
    certName: cert.certNumber,
    issuedOn,
  };
};

const getRoleFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email || '';
    return decoded.role || 'user';
  } catch {
    return null;
  }
};

const emailExistsInSystem = async (email) => {
  const found = await Certificate.findOne({
    email: new RegExp('^' + escapeRegex(email.trim()) + '$', 'i'),
  });
  return !!found;
};

// Transporter using Office365 SMTP as in emailController.js
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: "tech@khitamtherapy.com",
    pass: "gHyK2h$xU3VL",
  },
  tls: {
    rejectUnauthorized: false
  }
});

exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email' });
    }

    const isAdmin = await isAdminEmail(email);
    if (!isAdmin) {
      const inSystem = await emailExistsInSystem(email);
      if (!inSystem) {
        return res.status(403).json({
          success: false,
          message: 'Email không có trong danh sách chứng chỉ. Vui lòng dùng tra cứu bên dưới.',
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete existing OTPs for this email to prevent spam/confusion
    await Otp.deleteMany({ email });

    // Save new OTP
    const newOtp = new Otp({ email, otp });
    await newOtp.save();

    // Send Email
    const mailOptions = {
      from: '"Khitam Therapy" <tech@khitamtherapy.com>',
      to: email,
      subject: 'Mã xác nhận tra cứu chứng chỉ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #2c3e50; text-align: center;">Mã Xác Nhận (OTP)</h2>
          <p>Xin chào,</p>
          <p>Bạn đã yêu cầu mã xác nhận để truy cập hệ thống tra cứu chứng chỉ của Khitam Therapy.</p>
          <p>Mã OTP của bạn là: <strong style="font-size: 24px; color: #e74c3c; letter-spacing: 2px;">${otp}</strong></p>
          <p>Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
          <br/>
          <p>Trân trọng,<br/>Đội ngũ Khitam Therapy</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: 'Đã gửi mã OTP đến email của bạn' });
  } catch (error) {
    console.error('Lỗi khi request OTP:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi gửi OTP', error: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Thiếu email hoặc mã OTP' });
    }

    // Find valid OTP
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn' });
    }

    // Delete OTP after successful verification
    await Otp.deleteMany({ email });

    const isAdmin = await isAdminEmail(email);
    if (!isAdmin) {
      const inSystem = await emailExistsInSystem(email);
      if (!inSystem) {
        return res.status(403).json({
          success: false,
          message: 'Email không có trong danh sách chứng chỉ',
        });
      }
    }

    const role = isAdmin ? 'admin' : 'user';
    const token = jwt.sign({ email, role }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      success: true,
      message: 'Xác thực thành công',
      token,
      role,
    });
  } catch (error) {
    console.error('Lỗi khi verify OTP:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xác thực', error: error.message });
  }
};

exports.getCertificates = async (req, res) => {
  try {
    // Middleware-like check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Không có quyền truy cập (Thiếu token)' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    const { email } = decoded;

    const role =
      decoded.role === 'admin' || (await isAdminEmail(email)) ? 'admin' : 'user';

    let certificates = [];
    if (role === 'admin') {
      certificates = await Certificate.find({}).sort({ createdAt: -1 });
    } else {
      certificates = await Certificate.find({
        email: new RegExp('^' + escapeRegex(email) + '$', 'i'),
      }).sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      data: certificates,
      role,
      viewMode: role === 'admin' ? 'admin' : 'full',
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chứng chỉ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu', error: error.message });
  }
};

/**
 * Tra cứu theo email / họ tên / SĐT
 * - Admin (email trong CertificateAdmins + token / tra cứu đúng email admin): toàn bộ thông tin
 * - Còn lại: chỉ tên chứng chỉ + ngày cấp
 */
  exports.searchCertificates = async (req, res) => {
  try {
    await ensureCertificateAdmins();

    const { q, email, phone, fullName, courseQ } = req.body;

    const keyword = (q || email || phone || fullName || '').trim();
    const courseKeyword = (courseQ || '').trim();

    const authHeader = req.headers.authorization;
    let userEmail = null;
    let role = 'user';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.email;
        role = decoded.role;
      } catch (err) {}
    }

    const keywordIsAdminEmail = await isAdminEmail(keyword);
    const isAdmin = role === 'admin' || keywordIsAdminEmail;

    // Chỉ chặn nếu không phải admin và cả 2 ô tìm kiếm đều trống/ngắn
    if (!isAdmin && keyword.length < 2 && courseKeyword.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập ít nhất 2 ký tự để tìm kiếm',
      });
    }

    let certificates;
    if (isAdmin && !keyword && !courseKeyword) {
      // Admin lấy toàn bộ dữ liệu nếu không nhập gì
      certificates = await Certificate.find({}).sort({ createdAt: -1 }).lean();
    } else {
      let filter = {};
      const conditions = [];

      if (keyword) {
        const regex = new RegExp(escapeRegex(keyword), 'i');
        conditions.push({
          $or: [
            { email: regex }, 
            { phone: regex }, 
            { fullName: regex },
            { certNumber: regex },
            { newCertNumber: regex }
          ]
        });
      }

      if (courseKeyword) {
        const courseRegex = new RegExp(escapeRegex(courseKeyword), 'i');
        conditions.push({
          $or: [
            { courseName: courseRegex },
            { courseCode: courseRegex }
          ]
        });
      }

      if (conditions.length > 0) {
        filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
      }

      certificates = await Certificate.find(filter).sort({ createdAt: -1 }).lean();
    }

    const data = certificates.map(cert => {
      // Đảm bảo là plain object
      const plainCert = cert._doc ? cert.toObject() : cert;

      if (isAdmin) return plainCert;
      
      if (userEmail && plainCert.email && plainCert.email.toLowerCase() === userEmail.toLowerCase()) {
        return plainCert;
      }

      // Mask personal info for public or different users
      return {
        _id: plainCert._id,
        courseName: plainCert.courseName,
        courseCode: plainCert.courseCode,
        certNumber: plainCert.certNumber,
        newCertNumber: plainCert.newCertNumber,
        issueDate: plainCert.issueDate || plainCert.issuedOn,
        certificateUrl: plainCert.certificateUrl,
        fullName: '*** Bảo mật ***',
        email: '***',
        phone: '***',
        address: '***',
        studentCode: '***'
      };
    });

    return res.status(200).json({
      success: true,
      data,
      viewMode: isAdmin ? 'admin' : (userEmail ? 'user' : 'public'),
      count: data.length,
      isAdminQuery: keywordIsAdminEmail,
    });
  } catch (error) {
    console.error('Lỗi tra cứu:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tra cứu',
      error: error.message,
    });
  }
};

exports.updateCertificateUrl = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Thiếu token' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }

    const role = decoded.role === 'admin' || (await isAdminEmail(decoded.email)) ? 'admin' : 'user';
    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền cập nhật link chứng chỉ' });
    }

    const { id } = req.params;
    const { url } = req.body;

    const cert = await Certificate.findById(id);
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chứng chỉ' });
    }

    cert.certificateUrl = url;
    await cert.save();

    // Gửi email thông báo cho khách hàng nếu có email và có url
    if (url && cert.email) {
      try {
        const mailOptions = {
          from: '"Khitam Therapy" <tech@khitamtherapy.com>',
          to: cert.email,
          subject: 'Thông báo: Chứng chỉ của bạn đã được cập nhật',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
              <h2 style="color: #2c3e50; text-align: center;">Khitam Therapy - Thông báo Văn Bằng</h2>
              <p>Xin chào <strong>${cert.fullName || 'Học viên'}</strong>,</p>
              <p>Hệ thống vừa cập nhật chứng chỉ bản mềm (khóa học ${cert.courseName || cert.courseCode || ''}) của bạn.</p>
              <p>Vui lòng truy cập vào đường link sau: <br/><br/>
              <a href="http://localhost:3000/tra-cuu-chung-nhan" style="display: inline-block; padding: 10px 20px; background-color: #0a5c36; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">http://localhost:3000/tra-cuu-chung-nhan</a></p>
              <p>Chọn vào menu <strong>Tra cứu chứng chỉ</strong>, đăng nhập bằng email này để xem và <strong>tải văn bằng về máy cá nhân (Local)</strong>.</p>
              <br/>
              <p>Trân trọng,<br/>Đội ngũ Khitam Therapy</p>
            </div>
          `,
        };
        await transporter.sendMail(mailOptions);
        console.log('Đã gửi email thông báo chứng chỉ tới:', cert.email);
      } catch (emailErr) {
        console.error('Lỗi khi gửi email thông báo chứng chỉ:', emailErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Cập nhật thành công', data: cert });
  } catch (error) {
    console.error('Lỗi khi cập nhật URL chứng chỉ:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật URL', error: error.message });
  }
};
