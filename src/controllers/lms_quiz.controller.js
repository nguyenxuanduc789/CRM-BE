const LMSQuiz         = require("../models/lms_quiz.model");
const LMSQuizAttempt  = require("../models/lms_quiz_attempt.model");
const LMSActivity     = require("../models/lms_activity.model");
const LMSProgress     = require("../models/lms_progress.model");
const LMSSection      = require("../models/lms_section.model");
const LMSCourse       = require("../models/lms_course.model");
const LMSNotification = require("../models/lms_notification.model");

class LMSQuizController {

  // ============================================================
  // ADMIN / INSTRUCTOR
  // ============================================================

  // POST /admin/quizzes  body: { activityId, title, description, questions, passingScore, timeLimit, allowRetry, maxAttempts, shuffleQuestions }
  static async createQuiz(req, res) {
    try {
      const {
        activityId, activity, title, description, questions,
        passingScore, timeLimit, allowRetry, maxAttempts, shuffleQuestions,
      } = req.body;

      const aid = activityId || activity;

      if (!aid)
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp activityId." });

      // Đặt activity.type = 'quiz' nếu chưa
      await LMSActivity.findByIdAndUpdate(aid, { type: "quiz" });

      const quiz = new LMSQuiz({
        activity: aid,
        title,
        description,
        questions: questions || [],
        passingScore: passingScore ?? 70,
        timeLimit: timeLimit ?? 0,
        allowRetry: allowRetry ?? true,
        maxAttempts: maxAttempts ?? 3,
        shuffleQuestions: shuffleQuestions ?? false,
      });
      await quiz.save();

      res.status(201).json({ success: true, data: quiz });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // PUT /admin/quizzes/:id
  static async updateQuiz(req, res) {
    try {
      const quiz = await LMSQuiz.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      res.status(200).json({ success: true, data: quiz });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /admin/quizzes/:id  (full với đáp án đúng)
  static async getQuizAdmin(req, res) {
    try {
      const quiz = await LMSQuiz.findById(req.params.id).populate("activity", "title type");
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      res.status(200).json({ success: true, data: quiz });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // STUDENT
  // ============================================================

  // GET /quiz/:activityId  (ẩn isCorrect với học viên)
  static async getQuiz(req, res) {
    try {
      const { activityId } = req.params;
      const quiz = await LMSQuiz.findOne({ activity: activityId });
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      // Ẩn isCorrect và explanation
      const safeQuestions = quiz.questions.map((q) => ({
        _id: q._id,
        questionText: q.questionText,
        type: q.type,
        points: q.points,
        essayMinWords: q.essayMinWords,
        options: q.options.map((o) => ({ _id: o._id, text: o.text })),
      }));

      // Đếm số lần thử của học viên
      const attemptCount = await LMSQuizAttempt.countDocuments({
        quiz: quiz._id,
        student: req.lmsUser._id,
      });

      res.status(200).json({
        success: true,
        data: {
          _id: quiz._id,
          activity: quiz.activity,
          title: quiz.title,
          description: quiz.description,
          questions: safeQuestions,
          passingScore: quiz.passingScore,
          timeLimit: quiz.timeLimit,
          allowRetry: quiz.allowRetry,
          maxAttempts: quiz.maxAttempts,
          shuffleQuestions: quiz.shuffleQuestions,
        },
        attemptCount,
        canAttempt: quiz.allowRetry ? attemptCount < quiz.maxAttempts : attemptCount === 0,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /quiz/:activityId/attempt  (Bắt đầu làm bài)
  static async startAttempt(req, res) {
    try {
      const { activityId } = req.params;
      const quiz = await LMSQuiz.findOne({ activity: activityId });
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      const attemptCount = await LMSQuizAttempt.countDocuments({
        quiz: quiz._id,
        student: req.lmsUser._id,
      });

      if (!quiz.allowRetry && attemptCount > 0)
        return res.status(400).json({ success: false, message: "Bạn đã làm bài này rồi và không được thử lại." });

      if (quiz.allowRetry && attemptCount >= quiz.maxAttempts)
        return res.status(400).json({
          success: false,
          message: `Bạn đã hết lượt làm bài (tối đa ${quiz.maxAttempts} lần).`,
        });

      // Tìm courseId từ activity
      const activity = await LMSActivity.findById(activityId);
      let courseId = null;
      if (activity) {
        const section = await LMSSection.findById(activity.section);
        if (section) courseId = section.course;
      }

      const attempt = new LMSQuizAttempt({
        quiz: quiz._id,
        student: req.lmsUser._id,
        course: courseId,
        status: "in_progress",
      });
      await attempt.save();

      res.status(201).json({ success: true, data: attempt });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST /quiz/attempt/:attemptId/submit  body: { answers: [{ questionIndex, selectedOptions, essayAnswer }] }
  static async submitAttempt(req, res) {
    try {
      const { attemptId } = req.params;
      const { answers } = req.body;

      const attempt = await LMSQuizAttempt.findOne({ _id: attemptId, student: req.lmsUser._id });
      if (!attempt)
        return res.status(404).json({ success: false, message: "Bài làm không tồn tại." });

      if (attempt.status !== "in_progress")
        return res.status(400).json({ success: false, message: "Bài làm đã được nộp rồi." });

      const quiz = await LMSQuiz.findById(attempt.quiz);
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      let totalPoints = 0;
      let earnedPoints = 0;
      let hasEssay = false;
      const gradedAnswers = [];

      for (const q of quiz.questions) {
        totalPoints += q.points || 1;
      }

      for (const ans of answers || []) {
        const { questionIndex, selectedOptions, essayAnswer } = ans;
        const question = quiz.questions[questionIndex];

        if (!question) continue;

        const answerDetail = {
          questionIndex,
          selectedOptions: selectedOptions || [],
          essayAnswer: essayAnswer || "",
          isCorrect: null,
          pointsEarned: 0,
        };

        if (question.type === "essay") {
          hasEssay = true;
          // Essay chưa chấm tự động
          answerDetail.isCorrect = null;
          answerDetail.pointsEarned = 0;
        } else if (question.type === "single_choice") {
          // Kiểm tra option đúng
          const correctIndexes = question.options
            .map((o, i) => (o.isCorrect ? i : -1))
            .filter((i) => i !== -1);
          const selected = selectedOptions && selectedOptions.length > 0 ? selectedOptions[0] : -1;
          const isCorrect = correctIndexes.includes(selected);
          answerDetail.isCorrect = isCorrect;
          if (isCorrect) {
            answerDetail.pointsEarned = question.points || 1;
            earnedPoints += question.points || 1;
          }
        } else if (question.type === "multiple_choice") {
          // Tất cả đúng và không chọn sai
          const correctIndexes = new Set(
            question.options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i !== -1)
          );
          const selectedSet = new Set(selectedOptions || []);

          const allCorrectSelected = [...correctIndexes].every((i) => selectedSet.has(i));
          const noWrongSelected = [...selectedSet].every((i) => correctIndexes.has(i));
          const isCorrect = allCorrectSelected && noWrongSelected;
          answerDetail.isCorrect = isCorrect;
          if (isCorrect) {
            answerDetail.pointsEarned = question.points || 1;
            earnedPoints += question.points || 1;
          }
        }

        gradedAnswers.push(answerDetail);
      }

      const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const isPassed = !hasEssay && scorePercent >= quiz.passingScore;

      attempt.answers = gradedAnswers;
      attempt.totalPoints = totalPoints;
      attempt.earnedPoints = earnedPoints;
      attempt.scorePercent = scorePercent;
      attempt.isPassed = isPassed;
      attempt.submittedAt = new Date();
      attempt.status = hasEssay ? "submitted" : "graded";

      await attempt.save();

      // Nếu không có essay và đạt, đánh dấu activity hoàn thành
      if (!hasEssay && isPassed && attempt.course) {
        await LMSQuizController._markActivityComplete(
          req.lmsUser._id,
          attempt.course,
          quiz.activity
        );
      }

      res.status(200).json({ success: true, data: attempt });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /quiz/:activityId/attempts
  static async getMyAttempts(req, res) {
    try {
      const { activityId } = req.params;
      const quiz = await LMSQuiz.findOne({ activity: activityId });
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      const attempts = await LMSQuizAttempt.find({
        quiz: quiz._id,
        student: req.lmsUser._id,
      }).sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: attempts });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /quiz/attempt/:attemptId
  static async getAttemptDetail(req, res) {
    try {
      const attempt = await LMSQuizAttempt.findOne({
        _id: req.params.attemptId,
        student: req.lmsUser._id,
      }).populate("quiz");

      if (!attempt)
        return res.status(404).json({ success: false, message: "Bài làm không tồn tại." });

      res.status(200).json({ success: true, data: attempt });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // INSTRUCTOR GRADING
  // ============================================================

  // PUT /quiz/attempt/:attemptId/grade-essay  body: { questionIndex, pointsEarned, feedback }
  static async gradeEssay(req, res) {
    try {
      const { attemptId } = req.params;
      const { questionIndex, pointsEarned, feedback } = req.body;

      const attempt = await LMSQuizAttempt.findById(attemptId);
      if (!attempt)
        return res.status(404).json({ success: false, message: "Bài làm không tồn tại." });

      if (attempt.status === "in_progress")
        return res.status(400).json({ success: false, message: "Bài làm chưa được nộp." });

      const quiz = await LMSQuiz.findById(attempt.quiz);
      if (!quiz)
        return res.status(404).json({ success: false, message: "Quiz không tồn tại." });

      // Cập nhật điểm cho câu đó
      const answerIdx = attempt.answers.findIndex((a) => a.questionIndex === questionIndex);
      if (answerIdx === -1)
        return res.status(404).json({ success: false, message: "Câu trả lời không tồn tại." });

      attempt.answers[answerIdx].pointsEarned = pointsEarned || 0;
      attempt.answers[answerIdx].isCorrect = (pointsEarned || 0) > 0;

      if (feedback) attempt.instructorFeedback = feedback;
      attempt.gradedBy = req.lmsUser._id;

      // Kiểm tra tất cả câu essay đã được chấm chưa
      const quiz_questions = quiz.questions;
      const allEssaysGraded = attempt.answers.every((ans) => {
        const q = quiz_questions[ans.questionIndex];
        if (!q || q.type !== "essay") return true;
        return ans.isCorrect !== null;
      });

      if (allEssaysGraded) {
        // Tính lại tổng điểm
        let newEarned = 0;
        for (const ans of attempt.answers) {
          newEarned += ans.pointsEarned || 0;
        }
        attempt.earnedPoints = newEarned;
        attempt.scorePercent = attempt.totalPoints > 0
          ? Math.round((newEarned / attempt.totalPoints) * 100)
          : 0;
        attempt.isPassed = attempt.scorePercent >= quiz.passingScore;
        attempt.status = "graded";
        attempt.gradedAt = new Date();

        // Thông báo cho học viên
        await LMSNotification.create({
          recipient: attempt.student,
          type: "quiz_graded",
          title: "Bài thi đã được chấm điểm",
          message: `Bài làm của bạn đã được chấm. Điểm số: ${attempt.scorePercent}%`,
          data: { attemptId: attempt._id, quizId: quiz._id },
        });

        // Nếu đạt, đánh dấu hoàn thành activity
        if (attempt.isPassed && attempt.course) {
          await LMSQuizController._markActivityComplete(
            attempt.student,
            attempt.course,
            quiz.activity
          );
        }
      }

      await attempt.save();
      res.status(200).json({ success: true, data: attempt });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // ============================================================
  // Helper: Đánh dấu activity hoàn thành trong progress
  // ============================================================
  static async _markActivityComplete(studentId, courseId, activityId) {
    try {
      let progress = await LMSProgress.findOne({ student: studentId, course: courseId });

      if (!progress) {
        progress = new LMSProgress({ student: studentId, course: courseId });
      }

      const alreadyDone = progress.completedActivities.some(
        (a) => a.toString() === activityId.toString()
      );

      if (!alreadyDone) {
        progress.completedActivities.push(activityId);

        // Tính overallProgress
        const course = await LMSCourse.findById(courseId).populate("sections");
        let total = 0;
        for (const sectionId of course.sections) {
          const section = await LMSSection.findById(sectionId);
          if (section) total += (section.activities || []).length;
        }
        progress.overallProgress = total > 0
          ? Math.round((progress.completedActivities.length / total) * 100)
          : 0;

        await progress.save();
      }
    } catch (e) {
      console.error("Lỗi đánh dấu activity hoàn thành:", e.message);
    }
  }
}

module.exports = LMSQuizController;
