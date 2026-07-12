const Affiliate = require('../models/user.affiliate.model');
const AffiliateReport = require('../models/reportaff.model');
const UAParser = require('ua-parser-js');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/user.model');
const nodemailer = require('nodemailer');

// Cấu hình transporter cho nodemailer
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: "tech@khitamtherapy.com",
    pass: "gHyK2h$xU3VL",
  },
});

// Hàm tạo affiliateId tự động
const generateAffiliateId = async () => {
  const lastAffiliate = await Affiliate.findOne().sort({ affiliateId: -1 }).exec();
  if (!lastAffiliate) {
    return 'AFF0001';
  }
  const lastId = lastAffiliate.affiliateId;
  const numericPart = parseInt(lastId.replace('AFF', '')) + 1;
  return `AFF${numericPart.toString().padStart(4, '0')}`;
};

// Đăng ký affiliate
const registerAffiliate = async (req, res) => {
  try {
    const { name, email, password, stk, nganHang, chuTaiKhoan } = req.body;

    // Kiểm tra thông tin đầu vào
    if (!name || !email || !password || !stk || !nganHang || !chuTaiKhoan) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin' });
    }

    // Kiểm tra email đã tồn tại
    const existingEmail = await Affiliate.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    // Tạo affiliateId mới
    const affiliateId = await generateAffiliateId();

    // Tạo Affiliate mới
    const affiliate = new Affiliate({
      name,
      email,
      password,
      affiliateId,
      stk,
      nganHang,
      chuTaiKhoan,
      clicks: 1,
    });

    // Lưu Affiliate vào database
    await affiliate.save();

    // Gửi email chào mừng tới Affiliate
    const affiliateLink = `https://academy.khitamtherapy.com/affiliate/${affiliateId}`;
    const dashboardLink = `https://academy.khitamtherapy.com/affiliate-dashboard/`; // Thay bằng link thực tế nếu cần
    const guideLink = `https://academy.khitamtherapy.com/affiliate-guide/`; // Thay bằng link thực tế nếu cần

    const affiliateMailOptions = {
      from: 'tech@khitamtherapy.com',
      to: email,
      cc: ['nguyenthithanhdiem2806@gmail.com', 'khitamtherapytech@gmail.com'],
      subject: 'Chào mừng bạn trở thành Cộng Tác Viên của Khí Tâm Trị Liệu!',
      html: `
        <p>Xin chào ${name},</p>
        <p>Cảm ơn bạn đã đăng ký trở thành Cộng Tác Viên chính thức của Khí Tâm Trị Liệu, một hành trình cùng chia sẻ giá trị, lan toả sản phẩm chất lượng và tạo thu nhập thụ động bền vững.</p>
        <p><strong>Thông tin đăng nhập / truy cập hệ thống:</strong></p>
        <ul>
          <li>Link quản lý tài khoản Affiliate: <a href="${dashboardLink}">${dashboardLink}</a></li>
          <li>Email đăng ký: ${email}</li>
          <li>Mật khẩu: [Vui lòng sử dụng mật khẩu bạn đã nhập. Khuyến nghị đổi mật khẩu sau khi đăng nhập lần đầu.]</li>
        </ul>
        <p><strong>Link / mã giới thiệu cá nhân:</strong></p>
        <ul>
          <li>Link affiliate của bạn: <a href="${affiliateLink}">${affiliateLink}</a></li>
          <li>Mã giới thiệu cá nhân: ${affiliateId}</li>
          <li>Hướng dẫn sử dụng hệ thống Affiliate: <a href="${guideLink}">${guideLink}</a></li>
        </ul>
        <p>👉 Hãy sử dụng link hoặc mã này khi chia sẻ sản phẩm/dịch vụ. Tất cả đơn hàng phát sinh từ link/mã này đều được ghi nhận hoa hồng cho bạn.</p>
        <p>Một lần nữa, chào mừng bạn đến với cộng đồng CTV của Khí Tâm Trị Liệu!</p>
        <p>Chúc bạn nhiều năng lượng và thật nhiều đơn hàng.</p>
        <p>Thân mến,</p>
      `,
    };

    // Gửi email thông báo tới admin
    const adminEmail = 'ducprokb1234@gmail.com'; // Thay bằng email admin thực tế
    const adminMailOptions = {
      from: 'tech@khitamtherapy.com',
      to: adminEmail,
      cc: ['nguyenthithanhdiem2806@gmail.com', 'khitamtherapytech@gmail.com'],
      subject: 'Thông báo: Cộng Tác Viên mới đăng ký',
      html: `
        <p>Xin chào Admin,</p>
        <p>Một Cộng Tác Viên mới vừa đăng ký vào hệ thống Khí Tâm Trị Liệu. Dưới đây là thông tin chi tiết:</p>
        <ul>
          <li><strong>Họ và Tên:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Mã Affiliate:</strong> ${affiliateId}</li>
          <li><strong>Số Tài Khoản:</strong> ${stk}</li>
          <li><strong>Tên Ngân Hàng:</strong> ${nganHang}</li>
          <li><strong>Chủ Tài Khoản:</strong> ${chuTaiKhoan}</li>
          <li><strong>Link Affiliate:</strong> <a href="${affiliateLink}">${affiliateLink}</a></li>
          <li><strong>Thời gian đăng ký:</strong> ${new Date().toLocaleString('vi-VN')}</li>
        </ul>
        <p>Vui lòng kiểm tra và hỗ trợ Cộng Tác Viên mới nếu cần.</p>
        <p>Trân trọng,</p>
        <p>Hệ thống Khí Tâm Trị Liệu</p>
      `,
    };

    // Gửi cả hai email (không làm gián đoạn nếu một email thất bại)
    await Promise.all([
      transporter.sendMail(affiliateMailOptions).catch(err => console.error('Lỗi gửi email chào mừng:', err)),
      transporter.sendMail(adminMailOptions).catch(err => console.error('Lỗi gửi email thông báo admin:', err)),
    ]);

    // Cập nhật managedAffiliateIds của user Đức
    const managerId = "6673b41f56d8b67ed4a5465e"; // ID của Đức
    await User.findByIdAndUpdate(
      managerId,
      { $addToSet: { managedAffiliateIds: affiliateId } },
      { new: true }
    );

    // Trả về phản hồi thành công
    res.status(201).json({ 
      message: 'Đăng ký thành công', 
      affiliateId: affiliate.affiliateId 
    });
  } catch (error) {
    console.error('Lỗi đăng ký Affiliate:', error);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
};














// Đăng nhập affiliate
const loginAffiliate = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const affiliate = await Affiliate.findOne({ email });
    if (!affiliate) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const isMatch = await affiliate.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    res.status(200).json({
      message: 'Đăng nhập thành công',
      affiliateId: affiliate.affiliateId,
      name: affiliate.name,
      email: affiliate.email,
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
};

// Ghi nhận click
const recordClick = async (req, res) => {
  try {
    // Lấy dữ liệu từ request body
    const { affiliateLink, affiliateId } = req.body || {};
    if (!affiliateLink || !affiliateId) {
      console.log('Missing required fields:', { affiliateLink, affiliateId });
      return res.status(400).json({ message: 'Thiếu affiliateLink hoặc affiliateId' });
    }
    console.log('Request body:', { affiliateLink, affiliateId });

    // Lấy IP từ client
    const ip = req.clientIp || 'Unknown';
    console.log('Client IP:', ip);

    // Lấy User-Agent
    const userAgent = req.headers['user-agent'] || '';
    if (!userAgent) {
      console.log('User-Agent missing');
      return res.status(400).json({ message: 'User-Agent không được cung cấp!' });
    }
    console.log('User-Agent:', userAgent);

    // Xử lý deviceId
    let deviceId = req.cookies?.deviceId || null;
    console.log('Device ID from cookie:', deviceId);

    if (!deviceId) {
      deviceId = uuidv4(); // Tạo UUID mới nếu không có
      res.cookie('deviceId', deviceId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
        httpOnly: true,
        sameSite: 'none', // Cho phép cross-origin
        secure: ip === '::1' ? false : true, // Secure chỉ khi không phải localhost
      });
      console.log('New Device ID generated:', deviceId);
    }

    // Phân tích User-Agent
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    console.log('UA Parser Result:', result);

    const deviceInfo = {
      browser: result.browser.name || 'Unknown',
      os: result.os.name || 'Unknown',
      device: result.device.model || result.device.type || 'Unknown',
    };
    console.log('Device Info:', deviceInfo);

    // Kiểm tra User-Agent hợp lệ
    if (!result.browser.name) {
      console.log('Invalid User-Agent detected');
      await AffiliateReport.create({
        affiliate_id: affiliateId,
        ip,
        user_agent: userAgent,
        deviceId,
        affiliateLink,
        affiliate_name: affiliate.name,
        full_name: "",
        email: "",
        isValid: false,
      });
      return res.status(400).json({ message: 'User-agent không hợp lệ, nghi ngờ bot!' });
    }

    // Kiểm tra Affiliate
    console.log('Checking Affiliate with ID:', affiliateId);
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      console.log('Affiliate not found');
      return res.status(400).json({ message: 'Affiliate ID không tồn tại!' });
    }

    // Kiểm tra click trùng lặp dựa trên deviceId và affiliateLink
    console.log('Checking existing click for deviceId:', deviceId, 'and affiliateLink:', affiliateLink);
    const existingClick = await AffiliateReport.findOne({ deviceId, affiliateLink });
    if (existingClick) {
      console.log('Existing click found:', existingClick._id);
      return res.status(400).json({ message: 'Thiết bị này đã click vào link này trước đó!' });
    }

    // Kiểm tra số click trong 1 giờ dựa trên IP
    console.log('Counting clicks for IP:', ip);
    const clickCount = await AffiliateReport.countDocuments({
      ip,
      affiliateLink,
      datetime: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    console.log('Click count in last hour for this IP:', clickCount);

    if (clickCount > 10) {
      console.log('Too many clicks detected for this IP');
      await AffiliateReport.create({
        affiliate_id: affiliateId,
        affiliate_name: affiliate.name,
        full_name: "",
        email: "",
        ip,
        user_agent: userAgent,
        deviceId,
        affiliateLink,
        isValid: false,
      });
      return res.status(429).json({ message: 'Click không hợp lệ, nghi ngờ spam từ IP này!' });
    }

    // Kiểm tra bổ sung: Có bản ghi nào với cùng IP và affiliateLink không
    console.log('Checking for duplicate click with IP:', ip, 'and affiliateLink:', affiliateLink);
    const duplicateClick = await AffiliateReport.findOne({
      ip,
      affiliateLink,
    });
    if (duplicateClick) {
      console.log('Duplicate click found:', duplicateClick._id);
      return res.status(400).json({ message: 'Click trùng lặp từ cùng IP và affiliateLink!' });
    }

    // Ghi nhận click mới
    console.log('Creating new AffiliateReport');
    const newReport = await AffiliateReport.create({
      affiliate_id: affiliateId,
      affiliate_name: affiliate.name,
      full_name: "",
      email: "",
      ip,
      user_agent: userAgent,
      deviceId,
      affiliateLink,
      hitid: Math.floor(Math.random() * 1000000),
    });
    console.log('New AffiliateReport created:', newReport._id);

    // Cập nhật số click của Affiliate
    console.log('Updating Affiliate clicks for ID:', affiliateId);
    await Affiliate.updateOne({ affiliateId }, { $inc: { clicks: 1 } });

    // Trả về phản hồi với _id
    res.json({
      message: 'Click được ghi nhận!',
      redirect: affiliateLink,
      _id: newReport._id.toString(), // Chuyển ObjectId thành chuỗi
    });
  } catch (error) {
    console.error('Error in recordClick:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
const updateAffiliateReport = async (req, res) => {
  try {
    const { _id } = req.params; // Lấy _id từ URL
    const { email, full_name, phone } = req.body || {};

    // Kiểm tra _id
    if (!_id) {
      console.log('Missing _id');
      return res.status(400).json({ message: 'Thiếu _id' });
    }

    // Kiểm tra dữ liệu đầu vào
    if (!email && !full_name && !phone) {
      console.log('No fields to update');
      return res.status(400).json({ message: 'Cần cung cấp ít nhất một trường: email, full_name, hoặc phone' });
    }

    // Tạo object cập nhật
    const updateFields = {};
    if (email) updateFields.email = email;
    if (full_name) updateFields.full_name = full_name;
    if (phone) updateFields.phone = phone;

    console.log('Updating AffiliateReport with _id:', _id, 'Fields:', updateFields);

    // Cập nhật bản ghi
    const updatedReport = await AffiliateReport.findByIdAndUpdate(
      _id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedReport) {
      console.log('AffiliateReport not found for _id:', _id);
      return res.status(404).json({ message: 'Không tìm thấy bản ghi AffiliateReport!' });
    }

    console.log('AffiliateReport updated:', updatedReport._id);
    res.json({
      message: 'Cập nhật thành công!',
      report: {
        _id: updatedReport._id.toString(),
        email: updatedReport.email,
        full_name: updatedReport.full_name,
        phone: updatedReport.phone,
      },
    });
  } catch (error) {
    console.error('Error in updateAffiliateReport:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
// Xem danh sách click
const getClicks = async (req, res) => {
  try {
    const clicks = await AffiliateReport.find().sort({ datetime: -1 }).limit(100);
    res.json(clicks);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = { registerAffiliate, loginAffiliate, updateAffiliateReport,recordClick, getClicks };