const LMSCourse   = require("../models/lms_course.model");
const LMSSection  = require("../models/lms_section.model");
const LMSActivity = require("../models/lms_activity.model");
const LMSCategory = require("../models/lms_category.model");
const LMSBanner   = require("../models/lms_banner.model");
const LMSCoupon   = require("../models/lms_coupon.model");

class LMSCourseController {

  /**
   * GET /courses
   * Query: ?search=&category=&level=&minPrice=&maxPrice=&sort=newest|popular|price-asc|price-desc|rating&page=&limit=
   */
  static async getCourses(req, res) {
    try {
      const {
        search,
        category,
        level,
        minPrice,
        maxPrice,
        sort = "newest",
        page = 1,
        limit = 20,
      } = req.query;

      // Admin có thể thấy tất cả, người dùng thường chỉ thấy isApproved
      const isAdmin = req.lmsUser?.role === "admin";
      const filter = {};

      if (!isAdmin) {
        filter.isApproved = true;
        filter.status = "published";
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (category) filter.category = category;
      if (level) filter.level = level;

      if (minPrice !== undefined || maxPrice !== undefined) {
        filter.price = {};
        if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
      }

      // Sắp xếp
      let sortOption = { createdAt: -1 };
      if (sort === "popular") sortOption = { totalStudents: -1 };
      else if (sort === "price-asc") sortOption = { price: 1 };
      else if (sort === "price-desc") sortOption = { price: -1 };
      else if (sort === "rating") sortOption = { rating: -1 };

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [courses, total] = await Promise.all([
        LMSCourse.find(filter)
          .populate("instructor", "fullName avatar title")
          .populate("category", "name slug icon color")
          .sort(sortOption)
          .skip(skip)
          .limit(parseInt(limit))
          .select("-sections"),
        LMSCourse.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: courses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /courses/:id
   * Lấy chi tiết khóa học bao gồm cấu trúc cây (Section -> Activity)
   */
  static async getCourseDetails(req, res) {
    try {
      const course = await LMSCourse.findById(req.params.id)
        .populate("instructor", "fullName avatar title bio totalStudents totalCourses")
        .populate("category", "name slug icon color")
        .populate({
          path: "sections",
          options: { sort: { order: 1 } },
          populate: {
            path: "activities",
            model: "LMSActivity",
            options: { sort: { order: 1 } },
          },
        });

      if (!course) {
        return res.status(404).json({ success: false, message: "Khóa học không tồn tại." });
      }

      res.status(200).json({ success: true, data: course });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /activities/:id
   * Lấy chi tiết một bài học cụ thể
   */
  static async getActivity(req, res) {
    try {
      const activity = await LMSActivity.findById(req.params.id).populate({
        path: "content.zoomMeetingId",
        model: "LMSZoomMeeting",
      });

      if (!activity) {
        return res.status(404).json({ success: false, message: "Bài học không tồn tại." });
      }

      res.status(200).json({ success: true, data: activity });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ============================================================
  // PUBLIC ENDPOINTS
  // ============================================================

  // GET /categories (public)
  static async getPublicCategories(req, res) {
    try {
      const categories = await LMSCategory.find({ isActive: true })
        .populate("parentCategory", "name slug")
        .sort({ order: 1, name: 1 });
      res.status(200).json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /banners (public)
  static async getPublicBanners(req, res) {
    try {
      const banners = await LMSBanner.find({ isActive: true }).sort({ order: 1 });
      res.status(200).json({ success: true, data: banners });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /coupons/validate  body: { code, courseId }
  static async validateCoupon(req, res) {
    try {
      const { code, courseId } = req.body;
      if (!code) return res.status(400).json({ success: false, message: "Vui lòng nhập mã coupon." });

      const coupon = await LMSCoupon.findOne({ code: code.toUpperCase(), isActive: true });
      if (!coupon) return res.status(404).json({ success: false, message: "Mã coupon không tồn tại hoặc đã bị vô hiệu." });

      const now = new Date();
      if (coupon.expiresAt && coupon.expiresAt < now)
        return res.status(400).json({ success: false, message: "Mã coupon đã hết hạn." });

      if (coupon.usedCount >= coupon.maxUses)
        return res.status(400).json({ success: false, message: "Mã coupon đã hết lượt sử dụng." });

      if (courseId && coupon.courses.length > 0) {
        const applies = coupon.courses.some((c) => c.toString() === courseId.toString());
        if (!applies)
          return res.status(400).json({ success: false, message: "Mã coupon không áp dụng cho khóa học này." });
      }

      res.status(200).json({
        success: true,
        data: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderValue: coupon.minOrderValue,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = LMSCourseController;
