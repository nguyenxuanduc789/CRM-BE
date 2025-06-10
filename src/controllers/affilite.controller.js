const Affiliate = require('../models/user.affiliate.model');
const AffiliateReport = require('../models/reportaff.model');
const UAParser = require('ua-parser-js');
const { v4: uuidv4 } = require('uuid');

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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin' });
    }

    const existingEmail = await Affiliate.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    const affiliateId = await generateAffiliateId();

    const affiliate = new Affiliate({
      name,
      email,
      password,
      affiliateId,
      clicks: 1,
    });

    await affiliate.save();
    res.status(201).json({ message: 'Đăng ký thành công', affiliateId: affiliate.affiliateId });
  } catch (error) {
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

    // Kiểm tra số click trong 1 giờ dựa trên IP và userAgent
    console.log('Counting clicks for IP:', ip, 'and userAgent:', userAgent);
    const clickCount = await AffiliateReport.countDocuments({
      ip,
      user_agent: userAgent,
      datetime: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    console.log('Click count in last hour for this userAgent:', clickCount);

    if (clickCount > 10) {
      console.log('Too many clicks detected for this userAgent');
      await AffiliateReport.create({
        affiliate_id: affiliateId,
        affiliate_name: affiliate.name,
        full_name: affiliate.name,
        email: affiliate.email,
        ip,
        user_agent: userAgent,
        deviceId,
        affiliateLink,
        isValid: false,
      });
      return res.status(429).json({ message: 'Click không hợp lệ, nghi ngờ spam từ trình duyệt này!' });
    }

    // Kiểm tra bổ sung: Có bản ghi nào với cùng ip, userAgent, affiliateLink trong 1 giờ không
    console.log('Checking for duplicate click with IP:', ip, 'userAgent:', userAgent, 'and affiliateLink:', affiliateLink);
    const duplicateClick = await AffiliateReport.findOne({
      ip,
      user_agent: userAgent,
      affiliateLink,
      datetime: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (duplicateClick) {
      console.log('Duplicate click found:', duplicateClick._id);
      return res.status(400).json({ message: 'Click trùng lặp từ cùng trình duyệt và IP!' });
    }

    // Ghi nhận click mới
    console.log('Creating new AffiliateReport');
    const newReport = await AffiliateReport.create({
      affiliate_id: affiliateId,
      affiliate_name: affiliate.name,
      full_name: affiliate.name,
      email: affiliate.email,
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

    res.json({ message: 'Click được ghi nhận!', redirect: affiliateLink });
  } catch (error) {
    console.error('Error in recordClick:', error);
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

module.exports = { registerAffiliate, loginAffiliate, recordClick, getClicks };