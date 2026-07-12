const EliteMastermind = require("../models/EliteMaster.model");

const createEliteMastermind = async (req, res) => {
  try {
    const {
      // 1. Thông tin cá nhân
      name,
      yearOfBirth,
      location,
      completedCourses,
      currentJob,

      // 2. Định vị bản thân
      careerDirections,
      careerDirectionOther,

      // 3. Kế hoạch tài chính
      desiredHourlyRate,
      targetMonthlyIncome,
      targetYearlyIncome,
      nicheMarket,

      // 4. Cam kết & kỷ luật
      dailyStudyHours,
      dailyStudyTimeSlot,
      weeklyClientHours,
      disciplineCommitment,

      // 5. Trăn trở & nhu cầu
      biggestFear,
      directHelpNeeded,
      mentorFocus,
      mentorFocusOther,

      // Meta
      email,
      phone,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên là bắt buộc.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email là bắt buộc.",
      });
    }

    // Tạo document mới
    const newEntry = new EliteMastermind({
      name,
      yearOfBirth,
      location,
      completedCourses: completedCourses || [],
      currentJob,

      careerDirections: careerDirections || [],
      careerDirectionOther,

      desiredHourlyRate,
      targetMonthlyIncome,
      targetYearlyIncome,
      nicheMarket,

      dailyStudyHours,
      dailyStudyTimeSlot,
      weeklyClientHours,
      disciplineCommitment,

      biggestFear,
      directHelpNeeded,
      mentorFocus: mentorFocus || [],
      mentorFocusOther,

      email,
      phone,

      status: "pending",
      crmSynced: false,
      submittedAt: new Date(),
    });

    await newEntry.save();

    return res.status(201).json({
      success: true,
      message: `Cảm ơn ${name}! Đơn của bạn đã được nhận. Team sẽ review trong 24-48h và liên hệ để xác nhận + gửi lịch Mentorship đầu tiên.`,
      data: newEntry,
    });
  } catch (error) {
    console.error("❌ Lỗi tạo Elite Mastermind:", error);

    // Lỗi validation từ Mongoose
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ.",
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
    });
  }
};
const getEliteMasterminds = async (req, res) => {
  try {
    const data = await EliteMastermind.find().sort({ submittedAt: -1 });

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("❌ Lỗi lấy danh sách Elite Mastermind:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
    });
  }
};
module.exports = { createEliteMastermind ,getEliteMasterminds};