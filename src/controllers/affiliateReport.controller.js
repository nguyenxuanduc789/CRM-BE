const AffiliateReport = require("../models/reportaff.model");
const User = require('../models/user.model');
const Pipeline = require("../models/pineline.model.js");
const Contact = require("../models/contact.model.js");
const { model, Schema, Types } = require("mongoose");
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
    const user = await User.findById(userId).select("_id managedAffiliateIds");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    // Kiểm tra nếu người dùng không có mã affiliate nào để quản lý
    if (!user.managedAffiliateIds || user.managedAffiliateIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Người dùng chưa có mã affiliate nào để quản lý",
        data: [],
      });
    }

    // Xây dựng bộ lọc thời gian
    let dateFilter = {};
    const now = moment(); // Sử dụng múi giờ mặc định của hệ thống

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
      // Lọc theo affiliate_id từ managedAffiliateIds và datetime
      {
        $match: {
          affiliate_id: { $in: user.managedAffiliateIds },
          ...(Object.keys(dateFilter).length > 0 && {
            $and: [
              { datetime: { ...dateFilter } },
            ],
          }),
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
const getAffiliateReportsByUser = async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ params
    const { startDate, endDate } = req.query; // Lấy startDate, endDate từ query

    // Kiểm tra userId
    if (!userId) {
      return res.status(400).json({ error: 'Vui lòng cung cấp userId' });
    }

    // Kiểm tra startDate và endDate
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Vui lòng cung cấp startDate và endDate' });
    }

    // Chuyển đổi startDate và endDate thành đối tượng Date
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Kiểm tra định dạng ngày hợp lệ
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'startDate hoặc endDate không hợp lệ' });
    }

    // Đảm bảo endDate bao gồm cả ngày kết thúc (đặt giờ cuối ngày)
    end.setHours(23, 59, 59, 999);

    // Tìm user trong bảng User
    const user = await User.findById(userId).select('managedAffiliateIds email firstname lastname');
    if (!user) {
      return res.status(404).json({ error: `Không tìm thấy user với ID: ${userId}` });
    }

    // Lấy danh sách managedAffiliateIds
    const affiliateIds = user.managedAffiliateIds || [];
    if (affiliateIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'User không quản lý affiliate nào',
        user: {
          id: user._id,
          email: user.email,
          name: `${user.firstname} ${user.lastname}`,
        },
      });
    }

    // Tìm báo cáo trong AffiliateReport với affiliate_id và datetime
    const reports = await AffiliateReport.find({
      affiliate_id: { $in: affiliateIds },
      datetime: { $gte: start, $lte: end },
    }).lean();

    // Trả về kết quả
    res.status(200).json({
      success: true,
      data: reports,
      total: reports.length,
      message: 'Lấy báo cáo affiliate thành công',
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstname} ${user.lastname}`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
};

const getAffiliatePipelines = async (req, res) => {
  try {
    const { affiliate_id } = req.params; // Lấy affiliate_id từ params
    const { start_date, end_date } = req.query;

    // Kiểm tra affiliate_id hợp lệ
    if (!affiliate_id) {
      return res.status(400).json({ message: "affiliate_id không hợp lệ." });
    }

    // Xác thực và tạo bộ lọc ngày
    const dateFilter = {};
    if (start_date && !isNaN(Date.parse(start_date))) {
      dateFilter.createdAt = { $gte: new Date(start_date) };
    }
    if (end_date && !isNaN(Date.parse(end_date))) {
      dateFilter.createdAt = dateFilter.createdAt
        ? { ...dateFilter.createdAt, $lte: new Date(end_date) }
        : { $lte: new Date(end_date) };
    }

    // Lấy tất cả bản ghi AffiliateReport dựa trên affiliate_id
    const affiliateReports = await AffiliateReport.find({ affiliate_id });
    if (!affiliateReports.length) {
      return res.status(404).json({ message: "Không tìm thấy báo cáo affiliate." });
    }

    // Log tất cả AffiliateReports để debug
    console.log('AffiliateReports:', affiliateReports);

    // Tạo danh sách email, phone, full_name từ các bản ghi hợp lệ
    const emails = [];
    const phones = [];
    const full_names = [];

    affiliateReports.forEach(report => {
      if (report.email) emails.push(report.email.trim().toLowerCase());
      if (report.phone) phones.push(report.phone.trim());
      if (report.full_name) full_names.push(report.full_name.trim());
    });

    // Kiểm tra xem có dữ liệu hợp lệ không
    if (!emails.length && !phones.length && !full_names.length) {
      return res.status(400).json({
        message: "Không có dữ liệu hợp lệ trong AffiliateReport: tất cả email, phone, full_name đều rỗng.",
        affiliateReports
      });
    }

    // Lấy các Contact khớp với ít nhất một trong email, phone, hoặc name/full_name
    const matchingContacts = await Contact.find({
      $or: [
        ...(emails.length ? [{ email: { $in: emails } }] : []),
        ...(phones.length ? [{ phone: { $in: phones } }] : []),
        ...(full_names.length ? [{ name: { $in: full_names } }, { full_name: { $in: full_names } }] : []),
      ],
    }).select("_id");

    // Log matchingContacts để debug
    console.log('Matching Contacts:', matchingContacts);

    if (!matchingContacts.length) {
      return res.status(404).json({ message: "Không tìm thấy Contact khớp." });
    }

    // Lấy các pipeline có contact khớp và isAffiliate == true
    const contactIds = matchingContacts.map(c => c._id);
    const pipelines = await Pipeline.find({
      contact: { $in: contactIds },
      
      ...dateFilter,
    })
      .populate("user", "name email")
      .populate("contact", "name phone email")
      .populate("products", "name price")
      .sort({ createdAt: -1 });
    console.log('Pipelines:', pipelines);
    if (!pipelines.length) {
      return res.status(404).json({ message: "Không tìm thấy pipeline phù hợp." });
    }

    return res.status(200).json(pipelines);
  } catch (error) {
    console.error("Lỗi khi lấy pipelines:", error);
    return res.status(500).json({ message: "Lỗi server.", error: error.message });
  }
};
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};
const getAffiliateReportById = async (req, res) => {
  try {
    const { affiliate_id } = req.params;
    const { start_date, end_date } = req.query;

    // Kiểm tra affiliate_id
    if (!affiliate_id) {
      return res.status(400).json({ message: 'affiliate_id là bắt buộc' });
    }

    // Xây dựng query
    let query = { affiliate_id };

    // Thêm điều kiện thời gian nếu có
    if (start_date || end_date) {
      query.datetime = {};
      if (start_date) {
        if (!isValidDate(start_date)) {
          return res.status(400).json({ message: 'start_date không hợp lệ' });
        }
        query.datetime.$gte = new Date(start_date);
      }
      if (end_date) {
        if (!isValidDate(end_date)) {
          return res.status(400).json({ message: 'end_date không hợp lệ' });
        }
        // Đặt end_date đến cuối ngày (23:59:59.999)
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.datetime.$lte = endDate;
      }
    }

    // Lấy danh sách bản ghi
    const reports = await AffiliateReport.find(query).lean();

    // Tính tổng số click
    const totalClicks = reports.length;

    // Trả về response
    res.status(200).json({
      message: 'Lấy thông tin AffiliateReport thành công',
      data: reports,
      totalClicks,
    });
  } catch (error) {
    console.error('Lỗi khi lấy AffiliateReport:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
module.exports = { getAffiliatePipelines,getAffiliateReportById,createAffiliateReport ,getAffiliateReportsByUser,getAffiliateReportSummary,updateAffiliateReportByIp,getAffiliateReportsOfUser};