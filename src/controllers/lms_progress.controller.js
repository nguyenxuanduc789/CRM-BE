const LMSProgress = require("../models/lms_progress.model");
const LMSEnrollment = require("../models/lms_enrollment.model");
const LMSCourse = require("../models/lms_course.model");

class LMSProgressController {

  // Lấy tiến độ học của học viên trong 1 khóa học
  static async getProgress(req, res) {
    try {
      const { courseId } = req.params;
      const studentId = req.lmsUser?._id || req.user?._id || req.body.studentId;

      const progress = await LMSProgress.findOne({ student: studentId, course: courseId })
        .populate("completedActivities", "title type");

      res.status(200).json({ success: true, data: progress || { overallProgress: 0, completedActivities: [] } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Đánh dấu hoàn thành một bài học (activity)
  static async markActivityComplete(req, res) {
    try {
      const { courseId, activityId } = req.body;
      const studentId = req.lmsUser?._id || req.user?._id || req.body.studentId;

      const enrollment = await LMSEnrollment.findOne({ student: studentId, course: courseId });
      if (!enrollment) {
        return res.status(403).json({ success: false, message: "Bạn chưa đăng ký khóa học này." });
      }

      const course = await LMSCourse.findById(courseId).populate({
        path: "sections",
        populate: { path: "activities", model: "LMSActivity" }
      });
      const totalActivities = course.sections.reduce((sum, s) => sum + s.activities.length, 0);

      const progress = await LMSProgress.findOneAndUpdate(
        { student: studentId, course: courseId },
        { 
          $addToSet: { completedActivities: activityId }
        },
        { upsert: true, new: true }
      );

      // Update activityDetails specifically
      const activityIndex = progress.activityDetails.findIndex(a => a.activity.toString() === activityId);
      if (activityIndex > -1) {
        progress.activityDetails[activityIndex].status = 'completed';
      } else {
        progress.activityDetails.push({
          activity: activityId,
          status: 'completed'
        });
      }

      const completed = progress.completedActivities.length;
      progress.overallProgress = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;
      await progress.save();

      res.status(200).json({ success: true, data: progress });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Lưu tiến độ video (thời lượng đã xem)
  static async saveVideoProgress(req, res) {
    try {
      const { courseId, activityId, watchTime, duration } = req.body;
      const studentId = req.lmsUser?._id || req.user?._id || req.body.studentId;

      let progress = await LMSProgress.findOne({ student: studentId, course: courseId });
      if (!progress) {
        progress = new LMSProgress({
          student: studentId,
          course: courseId,
          completedActivities: [],
          activityDetails: [],
          overallProgress: 0
        });
      }

      const activityIndex = progress.activityDetails.findIndex(a => a.activity.toString() === activityId);
      if (activityIndex > -1) {
        // Only update if the new watchTime is greater
        if (watchTime > progress.activityDetails[activityIndex].watchTime) {
          progress.activityDetails[activityIndex].watchTime = watchTime;
        }
        if (progress.activityDetails[activityIndex].status === 'not_started') {
          progress.activityDetails[activityIndex].status = 'in_progress';
        }
        progress.activityDetails[activityIndex].lastAccessed = Date.now();
      } else {
        progress.activityDetails.push({
          activity: activityId,
          status: 'in_progress',
          watchTime: watchTime,
          lastAccessed: Date.now()
        });
      }

      await progress.save();
      res.status(200).json({ success: true, message: "Đã lưu tiến độ" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }


  // Đăng ký khóa học cho học viên
  static async enrollCourse(req, res) {
    try {
      const { courseId, studentId, paymentAmount, paymentMethod } = req.body;
      const sid = req.lmsUser?._id || req.user?._id || studentId;

      const existing = await LMSEnrollment.findOne({ student: sid, course: courseId });
      if (existing) {
        return res.status(400).json({ success: false, message: "Học viên đã đăng ký khóa học này rồi." });
      }

      const enrollment = new LMSEnrollment({
        student: sid,
        course: courseId,
        paymentAmount: paymentAmount || 0,
        paymentMethod: paymentMethod || "free",
      });
      await enrollment.save();

      res.status(201).json({ success: true, message: "Đăng ký khóa học thành công!", data: enrollment });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Lấy danh sách khóa học đã đăng ký của học viên (cho Dashboard)
  static async getMyEnrollments(req, res) {
    try {
      const studentId = req.lmsUser?._id || req.user?._id || req.query.studentId;
      const enrollments = await LMSEnrollment.find({ student: studentId, status: "active" })
        .populate({ path: "course", select: "title imageUrl description" });

      const result = await Promise.all(enrollments.map(async (e) => {
        const progress = await LMSProgress.findOne({ student: studentId, course: e.course._id });
        return { ...e.toObject(), overallProgress: progress?.overallProgress || 0 };
      }));

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = LMSProgressController;
