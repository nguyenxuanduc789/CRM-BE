const AffiliateReport = require("../models/reportaff.model");
const User = require('../models/user.model');
const moment = require('moment');
// Tạo một Affiliate Report mới
const createAffiliateReport = async (req, res) => {
  try {
    const {
      affiliate_id,
      affiliate_name,
      full_name,
      email,
      phone,
      ip,
      user_agent,
      hitid,
    } = req.body;

    // Kiểm tra affiliate_id (trường bắt buộc duy nhất)
    if (!affiliate_id) {
      return res.status(400).json({
        success: false,
        message: "affiliate_id is required",
      });
    }

    const newReport = new AffiliateReport({
      affiliate_id,
      affiliate_name,
      full_name,
      email,
      phone,
      ip,
      user_agent,
      hitid,
    });

    const savedReport = await newReport.save();

    res.status(201).json({
      success: true,
      message: "Affiliate report created successfully",
      data: savedReport,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating affiliate report",
      error: error.message,
    });
  }
};
const updateAffiliateReportByIp = async (req, res) => {
  try {
    const { ip, full_name, email, phone } = req.body;

    // Kiểm tra xem tất cả các trường có được cung cấp không
    if (!ip || !full_name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu cần thiết để cập nhật",
      });
    }

    // Tìm kiếm báo cáo affiliate theo IP
    const affiliateReport = await AffiliateReport.findOne({ ip });

    // Nếu không tìm thấy báo cáo nào với IP này
    if (!affiliateReport) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy báo cáo affiliate với IP này",
      });
    }

    // Cập nhật các trường dữ liệu
    affiliateReport.full_name = full_name;
    affiliateReport.email = email;
    affiliateReport.phone = phone;

    // Lưu lại những thay đổi vào cơ sở dữ liệu
    const updatedReport = await affiliateReport.save();

    // Trả về kết quả thành công
    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin affiliate thành công",
      data: updatedReport,
    });
  } catch (error) {
    // Xử lý lỗi
    res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi cập nhật báo cáo affiliate",
      error: error.message,
    });
  }
};
const getAffiliateReportsOfUser = async (req, res) => {
  const { userId } = req.params; // Lấy userId từ params
  const { start, end } = req.query; // Lấy tham số start và end từ query string

  try {
    // Kiểm tra người dùng
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra nếu người dùng không có mã affiliate
    if (!user.aff || user.aff.length === 0) {
      return res.status(200).json({ message: 'Người dùng chưa có mã affiliate nào', data: [] });
    }

    // Xây dựng điều kiện lọc theo thời gian
    let dateFilter = {};
    const now = moment(); // Thời điểm hiện tại

    if (start) {
      if (start === 'week') {
        // Từ đầu tuần (thứ Hai) đến hiện tại
        dateFilter.$gte = moment().startOf('isoWeek').toDate();
      } else if (start === 'month') {
        // Từ đầu tháng đến ngày hiện tại + 1 ngày
        dateFilter.$gte = moment().startOf('month').toDate();
        dateFilter.$lte = moment().add(1, 'days').toDate(); // Cộng thêm 1 ngày
      } else {
        // Nếu start là một ngày cụ thể (định dạng ISO, ví dụ: 2025-04-01)
        if (!moment(start).isValid()) {
          return res.status(400).json({ message: 'Định dạng ngày bắt đầu không hợp lệ' });
        }
        dateFilter.$gte = moment(start).toDate();
      }
    }

    if (end) {
      // Nếu có end, đặt ngày kết thúc (định dạng ISO)
      if (!moment(end).isValid()) {
        return res.status(400).json({ message: 'Định dạng ngày kết thúc không hợp lệ' });
      }
      dateFilter.$lte = moment(end).toDate();
    } else if (start && !dateFilter.$lte && start !== 'month') {
      // Mặc định kết thúc là hiện tại nếu không có end (trừ trường hợp month)
      dateFilter.$lte = now.toDate();
    }

    // Nếu không có bộ lọc thời gian hợp lệ, bỏ qua dateFilter
    const query = {
      affiliate_id: { $in: user.aff },
      ...(Object.keys(dateFilter).length > 0 && { datetime: dateFilter }),
    };

    // Lấy báo cáo từ AffiliateReport, sắp xếp theo datetime từ mới nhất đến cũ nhất
    const reports = await AffiliateReport.find(query).sort({ datetime: -1 });

    return res.status(200).json({ data: reports });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu affiliate report:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
const getAffiliateReportSummary = async (req, res) => {
  const { userId } = req.params;
  const { start, end } = req.query;

  try {
    // Kiểm tra người dùng
    const user = await User.findById(userId).select("_id aff");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Kiểm tra nếu người dùng không có mã affiliate
    if (!user.aff || user.aff.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Người dùng chưa có mã affiliate nào",
        data: [],
      });
    }

    // Xây dựng bộ lọc thời gian
    let dateFilter = {};
    const now = moment();

    if (start) {
      if (start === "week") {
        dateFilter.$gte = moment().startOf("isoWeek").toDate();
      } else if (start === "month") {
        dateFilter.$gte = moment().startOf("month").toDate();
      } else if (moment(start).isValid()) {
        dateFilter.$gte = moment(start).toDate();
      } else {
        return res.status(400).json({
          success: false,
          message: "Tham số start không hợp lệ",
        });
      }
    }

    if (end) {
      if (moment(end).isValid()) {
        dateFilter.$lte = moment(end).toDate();
      } else {
        return res.status(400).json({
          success: false,
          message: "Tham số end không hợp lệ",
        });
      }
    } else if (start && !dateFilter.$lte) {
      dateFilter.$lte = now.toDate();
    }

    // Aggregation để đếm số lượng IP duy nhất
    const reportSummary = await AffiliateReport.aggregate([
      // Lọc theo affiliate_id và datetime
      {
        $match: {
          affiliate_id: { $in: user.aff },
          ...(Object.keys(dateFilter).length > 0 && { datetime: dateFilter }),
        },
      },
      // Nhóm theo ip để lấy các ip duy nhất
      {
        $group: {
          _id: "$ip",
        },
      },
      // Đếm số lượng ip duy nhất
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    // Định dạng kết quả
    const summary = reportSummary.length > 0
      ? [{ userId: user._id.toString(), count: reportSummary[0].count }]
      : [{ userId: user._id.toString(), count: 0 }];

    return res.status(200).json({
      success: true,
      message: "Tổng hợp báo cáo affiliate thành công",
      data: summary,
    });
  } catch (error) {
    console.error(`Lỗi khi tổng hợp báo cáo affiliate cho userId ${userId}:`, error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
module.exports = { createAffiliateReport ,getAffiliateReportSummary,updateAffiliateReportByIp,getAffiliateReportsOfUser};