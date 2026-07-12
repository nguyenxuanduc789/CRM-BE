const LMSWishlist       = require("../models/lms_wishlist.model");
const LMSReview         = require("../models/lms_review.model");
const LMSCourse         = require("../models/lms_course.model");
const LMSQa             = require("../models/lms_qa.model");
const LMSNote           = require("../models/lms_note.model");
const LMSEnrollment     = require("../models/lms_enrollment.model");
const LMSProgress       = require("../models/lms_progress.model");
const LMSCertificate    = require("../models/lms_lmscertificate.model");
const LMSOrder          = require("../models/lms_order.model");
const LMSCoupon         = require("../models/lms_coupon.model");
const LMSNotification   = require("../models/lms_notification.model");
const LMSActivity       = require("../models/lms_activity.model");
const LMSSection        = require("../models/lms_section.model");

class LMSStudentController {

  // ============================================================
  // WISHLIST
  // ============================================================

  // GET /wishlist
  static async getWishlist(req, res) {
    try {
      const wishlist = await LMSWishlist.findOne({ student: req.lmsUser._id }).populate({
        path: "courses.course",
        select: "title price thumbnail imageUrl instructor rating totalStudents",
        populate: { path: "instructor", select: "fullName avatar" },
      });

      res.status(200).json({ success: true, data: wishlist || { courses: [] } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /wishlist  body: { courseId }
  static async addToWishlist(req, res) {
    try {
      const { courseId } = req.body;
      if (!courseId)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp courseId." });

      const course = await LMSCourse.findById(courseId);
      if (!course)
        return res.status(404).json({ success: false, message: "Khóa học không tồn tại." });

      const wishlist = await LMSWishlist.findOneAndUpdate(
        { student: req.lmsUser._id },
        { $addToSet: { courses: { course: courseId, addedAt: new Date() } } },
        { upsert: true, new: true }
      );

      res.status(200).json({ success: true, data: wishlist });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /wishlist/:courseId
  static async removeFromWishlist(req, res) {
    try {
      const { courseId } = req.params;
      const wishlist = await LMSWishlist.findOneAndUpdate(
        { student: req.lmsUser._id },
        { $pull: { courses: { course: courseId } } },
        { new: true }
      );

      res.status(200).json({ success: true, data: wishlist });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // REVIEWS
  // ============================================================

  // GET /reviews?courseId=
  static async getReviews(req, res) {
    try {
      const { courseId } = req.query;
      if (!courseId)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp courseId." });

      const reviews = await LMSReview.find({ course: courseId, isApproved: true })
        .populate("student", "fullName avatar")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: reviews });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /reviews  body: { courseId, rating, comment }
  static async addReview(req, res) {
    try {
      const { courseId, rating, comment } = req.body;
      if (!courseId || !rating)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp courseId và rating." });

      // Kiểm tra đã đăng ký khóa học chưa
      const enrolled = await LMSEnrollment.findOne({
        student: req.lmsUser._id,
        course: courseId,
      });
      if (!enrolled)
        return res.status(403).json({ success: false, message: "Bạn chưa đăng ký khóa học này." });

      // Upsert review
      const review = await LMSReview.findOneAndUpdate(
        { course: courseId, student: req.lmsUser._id },
        { rating, comment, isApproved: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Tính lại rating trung bình của khóa học
      const reviews = await LMSReview.find({ course: courseId, isApproved: true });
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await LMSCourse.findByIdAndUpdate(courseId, {
        rating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
      });

      res.status(200).json({ success: true, data: review });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /reviews/:id
  static async deleteReview(req, res) {
    try {
      const review = await LMSReview.findOne({ _id: req.params.id, student: req.lmsUser._id });
      if (!review)
        return res.status(404).json({ success: false, message: "Đánh giá không tồn tại hoặc không có quyền xóa." });

      const courseId = review.course;
      await LMSReview.findByIdAndDelete(req.params.id);

      // Cập nhật lại rating
      const reviews = await LMSReview.find({ course: courseId, isApproved: true });
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      await LMSCourse.findByIdAndUpdate(courseId, {
        rating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
      });

      res.status(200).json({ success: true, message: "Xóa đánh giá thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // Q&A
  // ============================================================

  // GET /qa?courseId=&activityId=
  static async getQA(req, res) {
    try {
      const { courseId, activityId } = req.query;
      if (!courseId)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp courseId." });

      const filter = { course: courseId };
      if (activityId) filter.activity = activityId;

      const qas = await LMSQa.find(filter)
        .populate("student", "fullName avatar")
        .populate("answers.author", "fullName avatar")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: qas });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /qa  body: { courseId, activityId, question }
  static async createQuestion(req, res) {
    try {
      const { courseId, activityId, question } = req.body;
      if (!courseId || !question)
        return res.status(400).json({ success: false, message: "Vui lòng nhập courseId và câu hỏi." });

      const qa = new LMSQa({
        course: courseId,
        activity: activityId || null,
        student: req.lmsUser._id,
        question,
        views: 1,
      });
      await qa.save();

      const populated = await LMSQa.findById(qa._id)
        .populate("student", "fullName avatar");

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /qa/:id/answer  body: { content }
  static async addAnswer(req, res) {
    try {
      const { content } = req.body;
      if (!content)
        return res.status(400).json({ success: false, message: "Nội dung câu trả lời không được trống." });

      const isInstructor = ["trainer", "admin"].includes(req.lmsUser.role);

      const qa = await LMSQa.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            answers: {
              author: req.lmsUser._id,
              content,
              isInstructor,
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      )
        .populate("student", "fullName avatar")
        .populate("answers.author", "fullName avatar");

      if (!qa)
        return res.status(404).json({ success: false, message: "Câu hỏi không tồn tại." });

      res.status(200).json({ success: true, data: qa });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /qa/:id/upvote
  static async upvoteQuestion(req, res) {
    try {
      const qa = await LMSQa.findById(req.params.id);
      if (!qa)
        return res.status(404).json({ success: false, message: "Câu hỏi không tồn tại." });

      const userId = req.lmsUser._id.toString();
      const alreadyUpvoted = qa.upvotes.some((id) => id.toString() === userId);

      if (alreadyUpvoted) {
        qa.upvotes = qa.upvotes.filter((id) => id.toString() !== userId);
      } else {
        qa.upvotes.push(req.lmsUser._id);
      }
      await qa.save();

      res.status(200).json({ success: true, data: qa, upvoted: !alreadyUpvoted });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /qa/:id/resolve
  static async markResolved(req, res) {
    try {
      const qa = await LMSQa.findById(req.params.id);
      if (!qa)
        return res.status(404).json({ success: false, message: "Câu hỏi không tồn tại." });

      const isOwner = qa.student.toString() === req.lmsUser._id.toString();
      const isStaff = ["trainer", "admin"].includes(req.lmsUser.role);

      if (!isOwner && !isStaff)
        return res.status(403).json({ success: false, message: "Không có quyền thực hiện." });

      qa.isResolved = true;
      await qa.save();

      res.status(200).json({ success: true, data: qa });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // NOTES
  // ============================================================

  // GET /notes?courseId=&activityId=
  static async getNotes(req, res) {
    try {
      const { courseId, activityId } = req.query;
      if (!courseId)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp courseId." });

      const filter = { student: req.lmsUser._id, course: courseId };
      if (activityId) filter.activity = activityId;

      const notes = await LMSNote.find(filter).sort({ timestamp: 1 });
      res.status(200).json({ success: true, data: notes });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /notes  body: { activityId, courseId, timestamp, content }
  static async createNote(req, res) {
    try {
      const { activityId, courseId, timestamp, content } = req.body;
      if (!activityId || !courseId || !content)
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

      const note = new LMSNote({
        student: req.lmsUser._id,
        activity: activityId,
        course: courseId,
        timestamp: timestamp || 0,
        content,
      });
      await note.save();

      res.status(201).json({ success: true, data: note });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /notes/:id  body: { content, timestamp }
  static async updateNote(req, res) {
    try {
      const note = await LMSNote.findOne({ _id: req.params.id, student: req.lmsUser._id });
      if (!note)
        return res.status(404).json({ success: false, message: "Ghi chú không tồn tại hoặc không có quyền sửa." });

      const { content, timestamp } = req.body;
      if (content !== undefined) note.content = content;
      if (timestamp !== undefined) note.timestamp = timestamp;
      await note.save();

      res.status(200).json({ success: true, data: note });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /notes/:id
  static async deleteNote(req, res) {
    try {
      const note = await LMSNote.findOneAndDelete({ _id: req.params.id, student: req.lmsUser._id });
      if (!note)
        return res.status(404).json({ success: false, message: "Ghi chú không tồn tại hoặc không có quyền xóa." });

      res.status(200).json({ success: true, message: "Xóa ghi chú thành công." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // CERTIFICATE
  // ============================================================

  // GET /certificate/:courseId
  static async getCertificate(req, res) {
    try {
      const { courseId } = req.params;
      const studentId = req.lmsUser._id;

      // Kiểm tra đăng ký
      const enrollment = await LMSEnrollment.findOne({ student: studentId, course: courseId });
      if (!enrollment)
        return res.status(403).json({ success: false, message: "Bạn chưa đăng ký khóa học này." });

      // Lấy tất cả activity của khóa học (qua sections)
      const course = await LMSCourse.findById(courseId).populate("sections");
      if (!course)
        return res.status(404).json({ success: false, message: "Khóa học không tồn tại." });

      // Đếm tổng activity qua sections
      let totalActivities = 0;
      for (const sectionId of course.sections) {
        const section = await LMSSection.findById(sectionId);
        if (section && section.activities) {
          totalActivities += section.activities.length;
        }
      }

      // Lấy progress
      const progress = await LMSProgress.findOne({ student: studentId, course: courseId });
      const completedCount = progress ? progress.completedActivities.length : 0;
      const completionPercent = totalActivities > 0
        ? Math.round((completedCount / totalActivities) * 100)
        : 0;

      if (completionPercent < 100) {
        return res.status(200).json({
          success: false,
          message: "Bạn chưa hoàn thành khóa học",
          completionPercent,
        });
      }

      // Kiểm tra chứng chỉ đã tồn tại
      const existing = await LMSCertificate.findOne({ student: studentId, course: courseId })
        .populate("student", "fullName email")
        .populate("course", "title");
      if (existing)
        return res.status(200).json({ success: true, data: existing, alreadyIssued: true });

      // Tạo chứng chỉ mới
      const certNumber = "KHT-" + new Date().getFullYear() + "-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      const certificate = new LMSCertificate({
        student: studentId,
        course: courseId,
        certificateNumber: certNumber,
        issuedAt: new Date(),
        completedAt: new Date(),
      });
      await certificate.save();

      // Tạo thông báo
      await LMSNotification.create({
        recipient: studentId,
        type: "certificate_issued",
        title: "Chứng chỉ đã được cấp",
        message: `Chúc mừng! Bạn đã hoàn thành khóa học và nhận được chứng chỉ #${certNumber}`,
        data: { courseId, certificateNumber: certNumber },
      });

      const populated = await LMSCertificate.findById(certificate._id)
        .populate("student", "fullName email")
        .populate("course", "title");

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // ORDERS
  // ============================================================

  // POST /orders  body: { courseId, couponCode }
  static async createOrder(req, res) {
    try {
      const { courseId, couponCode } = req.body;
      if (!courseId)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp courseId." });

      const studentId = req.lmsUser._id;

      // Kiểm tra đã đăng ký chưa
      const alreadyEnrolled = await LMSEnrollment.findOne({ student: studentId, course: courseId });
      if (alreadyEnrolled)
        return res.status(400).json({ success: false, message: "Bạn đã đăng ký khóa học này rồi." });

      const course = await LMSCourse.findById(courseId);
      if (!course || !course.isApproved)
        return res.status(404).json({ success: false, message: "Khóa học không tồn tại hoặc chưa được duyệt." });

      const originalPrice = course.price || 0;
      let discountAmount = 0;
      let couponDoc = null;

      // Xử lý coupon
      if (couponCode) {
        couponDoc = await LMSCoupon.findOne({
          code: couponCode.toUpperCase(),
          isActive: true,
          usedCount: { $lt: { $ifNull: ["$maxUses", Infinity] } },
        });

        // Tìm lại đúng cách
        couponDoc = await LMSCoupon.findOne({ code: couponCode.toUpperCase(), isActive: true });

        if (couponDoc) {
          const now = new Date();
          const isExpired = couponDoc.expiresAt && couponDoc.expiresAt < now;
          const isMaxed = couponDoc.usedCount >= couponDoc.maxUses;
          const belowMin = originalPrice < couponDoc.minOrderValue;

          // Kiểm tra áp dụng cho khóa học này không
          const appliesToCourse =
            !couponDoc.courses || couponDoc.courses.length === 0 ||
            couponDoc.courses.some((c) => c.toString() === courseId.toString());

          if (!isExpired && !isMaxed && !belowMin && appliesToCourse) {
            if (couponDoc.discountType === "percent") {
              discountAmount = Math.round((originalPrice * couponDoc.discountValue) / 100);
            } else {
              discountAmount = couponDoc.discountValue;
            }
            discountAmount = Math.min(discountAmount, originalPrice);
          } else {
            couponDoc = null; // Coupon không hợp lệ
          }
        }
      }

      const finalPrice = Math.max(0, originalPrice - discountAmount);

      // Tạo order
      const order = new LMSOrder({
        student: studentId,
        course: courseId,
        originalPrice,
        discountAmount,
        finalPrice,
        coupon: couponDoc ? couponDoc._id : null,
        paymentMethod: "mock",
        paymentStatus: "pending",
      });

      // Mock payment: hoàn tất ngay
      order.paymentStatus = "completed";
      order.paidAt = new Date();
      order.transactionId = "MOCK-" + Date.now();
      await order.save();

      // Tăng usedCount coupon
      if (couponDoc) {
        await LMSCoupon.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: 1 } });
      }

      // Tạo enrollment
      await LMSEnrollment.create({
        student: studentId,
        course: courseId,
        paymentAmount: finalPrice,
        paymentMethod: "mock",
      });

      // Tăng totalStudents của khóa học
      await LMSCourse.findByIdAndUpdate(courseId, { $inc: { totalStudents: 1 } });

      // Tạo thông báo
      await LMSNotification.create({
        recipient: studentId,
        type: "payment_success",
        title: "Thanh toán thành công",
        message: `Bạn đã đăng ký thành công khóa học "${course.title}"`,
        data: { courseId, orderId: order._id },
      });

      const populated = await LMSOrder.findById(order._id)
        .populate("course", "title thumbnail imageUrl price");

      res.status(201).json({ success: true, order: populated, enrolled: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /orders
  static async getMyOrders(req, res) {
    try {
      const orders = await LMSOrder.find({ student: req.lmsUser._id })
        .populate("course", "title thumbnail imageUrl price")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /orders/:id
  static async getOrderDetail(req, res) {
    try {
      const order = await LMSOrder.findOne({ _id: req.params.id, student: req.lmsUser._id })
        .populate("course", "title thumbnail imageUrl price")
        .populate("coupon", "code discountType discountValue");

      if (!order)
        return res.status(404).json({ success: false, message: "Đơn hàng không tồn tại." });

      res.status(200).json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  // GET /notifications
  static async getNotifications(req, res) {
    try {
      const notifications = await LMSNotification.find({ recipient: req.lmsUser._id })
        .sort({ createdAt: -1 })
        .limit(50);

      res.status(200).json({ success: true, data: notifications });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /notifications/:id/read
  static async markAsRead(req, res) {
    try {
      const notification = await LMSNotification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.lmsUser._id },
        { isRead: true },
        { new: true }
      );

      if (!notification)
        return res.status(404).json({ success: false, message: "Thông báo không tồn tại." });

      res.status(200).json({ success: true, data: notification });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /notifications/read-all
  static async markAllRead(req, res) {
    try {
      await LMSNotification.updateMany(
        { recipient: req.lmsUser._id, isRead: false },
        { isRead: true }
      );

      res.status(200).json({ success: true, message: "Đã đánh dấu tất cả là đã đọc." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = LMSStudentController;
