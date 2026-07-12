const LMSCourse       = require("../models/lms_course.model");
const LMSSection      = require("../models/lms_section.model");
const LMSActivity     = require("../models/lms_activity.model");
const LMSZoomMeeting  = require("../models/lms_zoom_meeting.model");
const ZoomService     = require("../services/zoom.service");
const LMSUser         = require("../models/lms_user.model");
const LMSCategory     = require("../models/lms_category.model");
const LMSCoupon       = require("../models/lms_coupon.model");
const LMSOrder        = require("../models/lms_order.model");
const LMSBanner       = require("../models/lms_banner.model");
const LMSCertificate  = require("../models/lms_lmscertificate.model");
const LMSNotification = require("../models/lms_notification.model");

class LMSAdminController {

  // ----------- COURSE CRUD -----------
  static async createCourse(req, res) {
    try {
      const { title, description, price, imageUrl, status } = req.body;
      const course = new LMSCourse({
        title,
        description,
        price: price || 0,
        imageUrl,
        status: status || "draft",
        instructor: req.lmsUser?._id || req.user?._id || req.body.instructorId,
      });
      await course.save();
      res.status(201).json({ success: true, data: course });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateCourse(req, res) {
    try {
      const course = await LMSCourse.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!course) return res.status(404).json({ success: false, message: "Course not found" });
      res.status(200).json({ success: true, data: course });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteCourse(req, res) {
    try {
      await LMSCourse.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true, message: "Course deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ----------- SECTION CRUD -----------
  static async createSection(req, res) {
    try {
      const { title, description, courseId, course, order } = req.body;
      const cid = courseId || course;
      const section = new LMSSection({ title, description, course: cid, order: order || 0 });
      await section.save();
      await LMSCourse.findByIdAndUpdate(cid, { $push: { sections: section._id } });
      res.status(201).json({ success: true, data: section });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSection(req, res) {
    try {
      const section = await LMSSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!section) return res.status(404).json({ success: false, message: "Section not found" });
      res.status(200).json({ success: true, data: section });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteSection(req, res) {
    try {
      const section = await LMSSection.findByIdAndDelete(req.params.id);
      if (section) {
        // Clear all activities in this section
        await LMSActivity.deleteMany({ section: section._id });
        // Pull section from course
        await LMSCourse.findByIdAndUpdate(section.course, { $pull: { sections: section._id } });
      }
      res.status(200).json({ success: true, message: "Section deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ----------- ACTIVITY CRUD -----------
  static async createActivity(req, res) {
    try {
      const { title, type, sectionId, section, order, content } = req.body;
      const sid = sectionId || section;
      const activity = new LMSActivity({ title, type, section: sid, order: order || 0, content });
      await activity.save();
      await LMSSection.findByIdAndUpdate(sid, { $push: { activities: activity._id } });
      res.status(201).json({ success: true, data: activity });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateActivity(req, res) {
    try {
      const updateData = { ...req.body };
      
      // Map flat videoUrl, pdfUrl, textContent to nested content path
      if (req.body.videoUrl !== undefined) {
        updateData["content.videoUrl"] = req.body.videoUrl;
        delete updateData.videoUrl;
      }
      if (req.body.pdfUrl !== undefined) {
        updateData["content.pdfUrl"] = req.body.pdfUrl;
        delete updateData.pdfUrl;
      }
      if (req.body.textContent !== undefined) {
        updateData["content.textContent"] = req.body.textContent;
        delete updateData.textContent;
      }

      const activity = await LMSActivity.findByIdAndUpdate(
        req.params.id, 
        { $set: updateData }, 
        { new: true }
      );
      if (!activity) return res.status(404).json({ success: false, message: "Activity not found" });
      res.status(200).json({ success: true, data: activity });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteActivity(req, res) {
    try {
      const activity = await LMSActivity.findByIdAndDelete(req.params.id);
      if (activity) {
        await LMSSection.findByIdAndUpdate(activity.section, { $pull: { activities: activity._id } });
      }
      res.status(200).json({ success: true, message: "Activity deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ----------- ZOOM MEETING CRUD -----------
  static async createZoomMeeting(req, res) {
    try {
      const { topic, startTime, duration, courseId, autoCreate } = req.body;

      let meetingDetails = {
        meetingId: req.body.meetingId || "853" + Math.floor(10000000 + Math.random() * 90000000),
        passcode: req.body.passcode || "123456",
        startUrl: req.body.startUrl || `https://zoom.us/s/${req.body.meetingId}?pwd=${req.body.passcode || "123456"}`,
        joinUrl: req.body.joinUrl || `https://zoom.us/j/${req.body.meetingId}?pwd=${req.body.passcode || "123456"}`,
      };

      if (autoCreate || !req.body.meetingId) {
        const zoomMeeting = await ZoomService.createZoomMeeting({
          topic,
          startTime,
          duration: Number(duration),
          passcode: req.body.passcode,
        });
        meetingDetails = zoomMeeting;
      }

      const meeting = new LMSZoomMeeting({
        topic,
        meetingId: meetingDetails.meetingId,
        passcode: meetingDetails.passcode,
        startUrl: meetingDetails.startUrl,
        joinUrl: meetingDetails.joinUrl,
        startTime,
        duration,
        host: req.lmsUser?._id || req.user?._id || req.body.hostId,
        course: courseId,
      });

      await meeting.save();
      res.status(201).json({ success: true, data: meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteZoomMeeting(req, res) {
    try {
      const meeting = await LMSZoomMeeting.findById(req.params.id);
      if (!meeting) {
        return res.status(404).json({ success: false, message: "Không tìm thấy phòng học" });
      }
      await LMSZoomMeeting.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true, message: "Xóa phòng học thành công" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  // GET /admin/users?search=&role=&page=&limit=
  static async listUsers(req, res) {
    try {
      const { search, role, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (role) filter.role = role;
      if (search) {
        filter.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [users, total] = await Promise.all([
        LMSUser.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        LMSUser.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: users,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /admin/users/:id
  static async getUserDetail(req, res) {
    try {
      const user = await LMSUser.findById(req.params.id).select("-password");
      if (!user) return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /admin/users/:id  body: { role, status, fullName }
  static async updateUser(req, res) {
    try {
      const { role, status, fullName } = req.body;
      const update = {};
      if (role) update.role = role;
      if (status) update.status = status;
      if (fullName) update.fullName = fullName;

      const user = await LMSUser.findByIdAndUpdate(req.params.id, update, { new: true }).select("-password");
      if (!user) return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /admin/users/:id  (soft delete)
  static async deleteUser(req, res) {
    try {
      const user = await LMSUser.findByIdAndUpdate(
        req.params.id,
        { status: "inactive" },
        { new: true }
      ).select("-password");
      if (!user) return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });
      res.status(200).json({ success: true, message: "Tài khoản đã bị vô hiệu hóa.", data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // COURSE MANAGEMENT
  // ============================================================

  // GET /admin/courses
  static async listAllCourses(req, res) {
    try {
      const { search, status, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (search) filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [courses, total] = await Promise.all([
        LMSCourse.find(filter)
          .populate("instructor", "fullName email")
          .populate("category", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        LMSCourse.countDocuments(filter),
      ]);
      res.status(200).json({
        success: true,
        data: courses,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /admin/courses/:id/approve
  static async approveCourse(req, res) {
    try {
      const course = await LMSCourse.findByIdAndUpdate(
        req.params.id,
        { isApproved: true, status: "published" },
        { new: true }
      ).populate("instructor", "fullName email");

      if (!course) return res.status(404).json({ success: false, message: "Khóa học không tồn tại." });

      // Thông báo cho instructor
      await LMSNotification.create({
        recipient: course.instructor._id,
        type: "course_approved",
        title: "Khóa học đã được duyệt",
        message: `Khóa học "${course.title}" của bạn đã được phê duyệt và sẵn sàng xuất bản.`,
        data: { courseId: course._id },
      });

      res.status(200).json({ success: true, data: course });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /admin/courses/:id/reject  body: { rejectionReason }
  static async rejectCourse(req, res) {
    try {
      const { rejectionReason } = req.body;
      const course = await LMSCourse.findByIdAndUpdate(
        req.params.id,
        { isApproved: false, status: "draft" },
        { new: true }
      ).populate("instructor", "fullName email");

      if (!course) return res.status(404).json({ success: false, message: "Khóa học không tồn tại." });

      // Thông báo cho instructor
      await LMSNotification.create({
        recipient: course.instructor._id,
        type: "system",
        title: "Khóa học bị từ chối",
        message: `Khóa học "${course.title}" bị từ chối. Lý do: ${rejectionReason || "Không có lý do cụ thể."}`,
        data: { courseId: course._id, rejectionReason },
      });

      res.status(200).json({ success: true, data: course, rejectionReason });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // CATEGORY CRUD
  // ============================================================

  static async listCategories(req, res) {
    try {
      const categories = await LMSCategory.find({ isActive: true })
        .populate("parentCategory", "name")
        .sort({ order: 1, name: 1 });
      res.status(200).json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async createCategory(req, res) {
    try {
      const category = new LMSCategory(req.body);
      await category.save();
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateCategory(req, res) {
    try {
      const category = await LMSCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!category) return res.status(404).json({ success: false, message: "Danh mục không tồn tại." });
      res.status(200).json({ success: true, data: category });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteCategory(req, res) {
    try {
      await LMSCategory.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true, message: "Xóa danh mục thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // COUPON CRUD
  // ============================================================

  static async listCoupons(req, res) {
    try {
      const coupons = await LMSCoupon.find({}).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: coupons });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async createCoupon(req, res) {
    try {
      const coupon = new LMSCoupon(req.body);
      await coupon.save();
      res.status(201).json({ success: true, data: coupon });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateCoupon(req, res) {
    try {
      const coupon = await LMSCoupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!coupon) return res.status(404).json({ success: false, message: "Coupon không tồn tại." });
      res.status(200).json({ success: true, data: coupon });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteCoupon(req, res) {
    try {
      await LMSCoupon.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true, message: "Xóa coupon thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // ORDER MANAGEMENT
  // ============================================================

  // GET /admin/orders?page=&limit=
  static async listOrders(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const filter = {};
      if (status) filter.paymentStatus = status;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [orders, total] = await Promise.all([
        LMSOrder.find(filter)
          .populate("student", "fullName email")
          .populate("course", "title thumbnail")
          .populate("coupon", "code")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        LMSOrder.countDocuments(filter),
      ]);
      res.status(200).json({
        success: true,
        data: orders,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /admin/orders/:id
  static async getOrderDetail(req, res) {
    try {
      const order = await LMSOrder.findById(req.params.id)
        .populate("student", "fullName email phone")
        .populate("course", "title thumbnail price")
        .populate("coupon", "code discountType discountValue");
      if (!order) return res.status(404).json({ success: false, message: "Đơn hàng không tồn tại." });
      res.status(200).json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /admin/orders/:id/refund
  static async refundOrder(req, res) {
    try {
      const order = await LMSOrder.findByIdAndUpdate(
        req.params.id,
        { paymentStatus: "refunded" },
        { new: true }
      );
      if (!order) return res.status(404).json({ success: false, message: "Đơn hàng không tồn tại." });
      res.status(200).json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // BANNER CRUD
  // ============================================================

  static async listBanners(req, res) {
    try {
      const banners = await LMSBanner.find({}).sort({ order: 1, createdAt: -1 });
      res.status(200).json({ success: true, data: banners });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async createBanner(req, res) {
    try {
      const banner = new LMSBanner(req.body);
      await banner.save();
      res.status(201).json({ success: true, data: banner });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateBanner(req, res) {
    try {
      const banner = await LMSBanner.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!banner) return res.status(404).json({ success: false, message: "Banner không tồn tại." });
      res.status(200).json({ success: true, data: banner });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteBanner(req, res) {
    try {
      await LMSBanner.findByIdAndDelete(req.params.id);
      res.status(200).json({ success: true, message: "Xóa banner thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // STATS
  // ============================================================

  // GET /admin/stats
  static async getStats(req, res) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalUsers,
        totalCourses,
        totalApprovedCourses,
        totalOrders,
        revenueAgg,
        newUsersThisMonth,
        revenueThisMonthAgg,
        topCourses,
        recentOrders,
      ] = await Promise.all([
        LMSUser.countDocuments({}),
        LMSCourse.countDocuments({}),
        LMSCourse.countDocuments({ isApproved: true }),
        LMSOrder.countDocuments({ paymentStatus: "completed" }),
        LMSOrder.aggregate([
          { $match: { paymentStatus: "completed" } },
          { $group: { _id: null, total: { $sum: "$finalPrice" } } },
        ]),
        LMSUser.countDocuments({ createdAt: { $gte: startOfMonth } }),
        LMSOrder.aggregate([
          { $match: { paymentStatus: "completed", paidAt: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: "$finalPrice" } } },
        ]),
        LMSCourse.find({ isApproved: true })
          .select("title thumbnail totalStudents rating instructor")
          .populate("instructor", "fullName")
          .sort({ totalStudents: -1 })
          .limit(5),
        LMSOrder.find({ paymentStatus: "completed" })
          .populate("student", "fullName email")
          .populate("course", "title")
          .sort({ createdAt: -1 })
          .limit(10),
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalCourses,
          totalApprovedCourses,
          totalOrders,
          totalRevenue: revenueAgg[0]?.total || 0,
          newUsersThisMonth,
          revenueThisMonth: revenueThisMonthAgg[0]?.total || 0,
          topCourses,
          recentOrders,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // CERTIFICATES
  // ============================================================

  // GET /admin/certificates
  static async listCertificates(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [certs, total] = await Promise.all([
        LMSCertificate.find({})
          .populate("student", "fullName email")
          .populate("course", "title")
          .sort({ issuedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        LMSCertificate.countDocuments({}),
      ]);
      res.status(200).json({
        success: true,
        data: certs,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = LMSAdminController;
