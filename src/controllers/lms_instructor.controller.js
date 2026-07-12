const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const LMSCourse        = require("../models/lms_course.model");
const LMSEnrollment    = require("../models/lms_enrollment.model");
const LMSProgress      = require("../models/lms_progress.model");
const LMSOrder         = require("../models/lms_order.model");
const LMSQa            = require("../models/lms_qa.model");
const LMSReview        = require("../models/lms_review.model");
const LMSSection       = require("../models/lms_section.model");
const LMSActivity      = require("../models/lms_activity.model");

// ============================================================
// Filename Sanitizer
// ============================================================
const sanitizeFilename = (filename) => {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove Vietnamese accents
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace non-alphanumeric chars with underscores
    .replace(/_+/g, "_"); // Collapse consecutive underscores
};

// ============================================================
// Multer: Video upload
// ============================================================
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/videos");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, Date.now() + "-" + sanitized);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Định dạng video không được hỗ trợ. Chỉ chấp nhận: mp4, mov, avi, mkv, webm"));
  },
});

// ============================================================
// Multer: Document upload
// ============================================================
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/documents");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, Date.now() + "-" + sanitized);
  },
});

const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".pptx", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Định dạng tài liệu không được hỗ trợ. Chỉ chấp nhận: pdf, doc, docx, pptx, xlsx"));
  },
});

class LMSInstructorController {

  // GET /instructor/stats
  static async getStats(req, res) {
    try {
      const instructorId = req.lmsUser._id;

      // Lấy tất cả khóa học của instructor
      const courses = await LMSCourse.find({ instructor: instructorId });
      const courseIds = courses.map((c) => c._id);

      const totalCourses = courses.length;
      const totalStudents = courses.reduce((sum, c) => sum + (c.totalStudents || 0), 0);

      // Tổng doanh thu từ đơn hàng completed
      const orders = await LMSOrder.find({
        course: { $in: courseIds },
        paymentStatus: "completed",
      });
      const totalRevenue = orders.reduce((sum, o) => sum + (o.finalPrice || 0), 0);

      // Doanh thu 6 tháng gần nhất
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyRevenue = await LMSOrder.aggregate([
        {
          $match: {
            course: { $in: courseIds },
            paymentStatus: "completed",
            paidAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
            revenue: { $sum: "$finalPrice" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalCourses,
          totalStudents,
          totalRevenue,
          totalOrders: orders.length,
          monthlyRevenue,
          courses: courses.map((c) => ({
            _id: c._id,
            title: c.title,
            totalStudents: c.totalStudents,
            rating: c.rating,
            status: c.status,
          })),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /instructor/enrollments?courseId=
  static async getMyEnrollments(req, res) {
    try {
      const instructorId = req.lmsUser._id;
      const { courseId } = req.query;

      const courses = await LMSCourse.find({ instructor: instructorId });
      const courseIds = courses.map((c) => c._id);

      const filter = { course: { $in: courseIds } };
      if (courseId) filter.course = courseId;

      const enrollments = await LMSEnrollment.find(filter)
        .populate("student", "fullName email avatar")
        .populate("course", "title thumbnail imageUrl")
        .sort({ enrolledAt: -1 });

      res.status(200).json({ success: true, data: enrollments });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /instructor/courses/:courseId/analytics
  static async getCourseAnalytics(req, res) {
    try {
      const { courseId } = req.params;

      const course = await LMSCourse.findOne({
        _id: courseId,
        instructor: req.lmsUser._id,
      });
      if (!course)
        return res.status(404).json({ success: false, message: "Khóa học không tồn tại hoặc không có quyền." });

      // Enrollments
      const enrollments = await LMSEnrollment.find({ course: courseId });
      const totalEnrollments = enrollments.length;

      // Progress
      const progresses = await LMSProgress.find({ course: courseId });
      const avgProgress = totalEnrollments > 0
        ? progresses.reduce((sum, p) => sum + (p.overallProgress || 0), 0) / totalEnrollments
        : 0;

      const completedEnrollments = progresses.filter((p) => p.overallProgress >= 100).length;
      const completionRate = totalEnrollments > 0
        ? Math.round((completedEnrollments / totalEnrollments) * 100)
        : 0;

      // Q&A chưa giải quyết
      const unresolvedQA = await LMSQa.countDocuments({ course: courseId, isResolved: false });

      // Reviews
      const reviews = await LMSReview.find({ course: courseId, isApproved: true });
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      // Activities
      const sections = await LMSSection.find({ course: courseId }).populate("activities");
      const activityStats = [];
      for (const section of sections) {
        for (const activityId of section.activities || []) {
          const completedCount = progresses.filter((p) =>
            p.completedActivities.some((a) => a.toString() === activityId.toString())
          ).length;
          activityStats.push({
            activityId,
            completedCount,
            completionRate: totalEnrollments > 0
              ? Math.round((completedCount / totalEnrollments) * 100)
              : 0,
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          totalEnrollments,
          avgProgress: Math.round(avgProgress),
          completionRate,
          completedEnrollments,
          unresolvedQA,
          reviews: {
            total: reviews.length,
            avgRating: Math.round(avgRating * 10) / 10,
          },
          activityStats,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /instructor/upload-video  (multipart)
  static uploadVideo(req, res) {
    const upload = videoUpload.single("video");
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Vui lòng chọn file video." });
      }
      res.status(200).json({
        success: true,
        data: {
          url: "/uploads/videos/" + req.file.filename,
          filename: req.file.filename,
          size: req.file.size,
        }
      });
    });
  }

  // POST /instructor/upload-document  (multipart)
  static uploadDocument(req, res) {
    const upload = documentUpload.single("document");
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Vui lòng chọn file tài liệu." });
      }
      res.status(200).json({
        success: true,
        data: {
          url: "/uploads/documents/" + req.file.filename,
          filename: req.file.filename,
          size: req.file.size,
        }
      });
    });
  }

  // GET /instructor/qa
  static async getInstructorQA(req, res) {
    try {
      const instructorId = req.lmsUser._id;
      const courses = await LMSCourse.find({ instructor: instructorId });
      const courseIds = courses.map((c) => c._id);

      const { unresolved } = req.query;
      const filter = { course: { $in: courseIds } };
      if (unresolved === "true") filter.isResolved = false;

      const qas = await LMSQa.find(filter)
        .populate("student", "fullName avatar")
        .populate("course", "title")
        .populate("answers.author", "fullName avatar")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: qas });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = LMSInstructorController;
