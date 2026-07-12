const express = require("express");
const LMSCourseController      = require("../../controllers/lms_courses.controller");
const LMSZoomController        = require("../../controllers/lms_zoom.controller");
const LMSZoomWebhookController = require("../../controllers/lms_zoom_webhook.controller");
const LMSProgressController    = require("../../controllers/lms_progress.controller");
const LMSAdminController       = require("../../controllers/lms_admin.controller");
const LMSAuthController        = require("../../controllers/lms_auth.controller");
const LMSStudentController     = require("../../controllers/lms_student.controller");
const LMSInstructorController  = require("../../controllers/lms_instructor.controller");
const LMSQuizController        = require("../../controllers/lms_quiz.controller");

const { requireAuth, requireRole } = LMSAuthController;

const router = express.Router();

// =============================================
// AUTH
// =============================================
router.post("/auth/login",           LMSAuthController.login);
router.post("/auth/logout",          LMSAuthController.logout);
router.get ("/auth/me",              LMSAuthController.me);
router.post("/auth/register",        LMSAuthController.register);
router.post("/auth/forgot-password", LMSAuthController.forgotPassword);
router.post("/auth/reset-password",  LMSAuthController.resetPassword);
router.put ("/auth/profile",         requireAuth, LMSAuthController.updateProfile);
router.put ("/auth/change-password", requireAuth, LMSAuthController.changePassword);

// =============================================
// ZOOM WEBHOOK (Public - Zoom gọi trực tiếp)
// =============================================
router.post("/zoom/webhook", LMSZoomWebhookController.handleWebhook);

// =============================================
// PUBLIC: Danh mục, Banner, Coupon
// =============================================
router.get ("/categories",        LMSCourseController.getPublicCategories);
router.get ("/banners",           LMSCourseController.getPublicBanners);
router.post("/coupons/validate",  LMSCourseController.validateCoupon);

// =============================================
// PUBLIC: Xem danh sách & chi tiết khóa học
// =============================================
router.get("/courses",        LMSCourseController.getCourses);
router.get("/courses/:id",    LMSCourseController.getCourseDetails);
router.get("/activities/:id", LMSCourseController.getActivity);

// =============================================
// STUDENT: Đăng ký & tiến độ (cần đăng nhập)
// =============================================
router.post("/enroll",             requireAuth, LMSProgressController.enrollCourse);
router.get ("/my-courses",         requireAuth, LMSProgressController.getMyEnrollments);
router.get ("/progress/:courseId", requireAuth, LMSProgressController.getProgress);
router.post("/progress/complete",  requireAuth, LMSProgressController.markActivityComplete);
router.post("/progress/video",     requireAuth, LMSProgressController.saveVideoProgress);

// Zoom
router.post("/zoom/signature",                          requireAuth, LMSZoomController.generateSignature);
router.get ("/zoom/meetings",                           requireAuth, LMSZoomController.getMeetings);
router.get ("/zoom/meetings/details/:roomName",         requireAuth, LMSZoomController.getMeetingByRoomName);
router.get ("/recordings",                              requireAuth, LMSZoomWebhookController.getRecordings);

// =============================================
// STUDENT: Orders
// =============================================
router.post("/orders",     requireAuth, LMSStudentController.createOrder);
router.get ("/orders",     requireAuth, LMSStudentController.getMyOrders);
router.get ("/orders/:id", requireAuth, LMSStudentController.getOrderDetail);

// =============================================
// STUDENT: Wishlist
// =============================================
router.get   ("/wishlist",             requireAuth, LMSStudentController.getWishlist);
router.post  ("/wishlist",             requireAuth, LMSStudentController.addToWishlist);
router.delete("/wishlist/:courseId",   requireAuth, LMSStudentController.removeFromWishlist);

// =============================================
// STUDENT: Q&A
// =============================================
router.get("/qa",                requireAuth, LMSStudentController.getQA);
router.post("/qa",               requireAuth, LMSStudentController.createQuestion);
router.post("/qa/:id/answer",    requireAuth, LMSStudentController.addAnswer);
router.put ("/qa/:id/upvote",    requireAuth, LMSStudentController.upvoteQuestion);
router.put ("/qa/:id/resolve",   requireAuth, LMSStudentController.markResolved);

// =============================================
// STUDENT: Notes
// =============================================
router.get   ("/notes",     requireAuth, LMSStudentController.getNotes);
router.post  ("/notes",     requireAuth, LMSStudentController.createNote);
router.put   ("/notes/:id", requireAuth, LMSStudentController.updateNote);
router.delete("/notes/:id", requireAuth, LMSStudentController.deleteNote);

// =============================================
// STUDENT: Reviews
// =============================================
router.get   ("/reviews",     requireAuth, LMSStudentController.getReviews);
router.post  ("/reviews",     requireAuth, LMSStudentController.addReview);
router.delete("/reviews/:id", requireAuth, LMSStudentController.deleteReview);

// =============================================
// STUDENT: Certificate
// =============================================
router.get("/certificate/:courseId", requireAuth, LMSStudentController.getCertificate);

// =============================================
// STUDENT: Notifications
// =============================================
router.get("/notifications",               requireAuth, LMSStudentController.getNotifications);
router.put("/notifications/read-all",      requireAuth, LMSStudentController.markAllRead);
router.put("/notifications/:id/read",      requireAuth, LMSStudentController.markAsRead);

// =============================================
// STUDENT: Quiz
// =============================================
// IMPORTANT: /quiz/attempt/:attemptId must come BEFORE /quiz/:activityId to avoid conflicts
router.get ("/quiz/attempt/:attemptId",         requireAuth, LMSQuizController.getAttemptDetail);
router.post("/quiz/attempt/:attemptId/submit",  requireAuth, LMSQuizController.submitAttempt);
router.get ("/quiz/:activityId",                requireAuth, LMSQuizController.getQuiz);
router.post("/quiz/:activityId/attempt",        requireAuth, LMSQuizController.startAttempt);
router.get ("/quiz/:activityId/attempts",       requireAuth, LMSQuizController.getMyAttempts);

// =============================================
// INSTRUCTOR
// =============================================
router.get ("/instructor/stats",                              requireAuth, requireRole("trainer", "admin"), LMSInstructorController.getStats);
router.get ("/instructor/enrollments",                        requireAuth, requireRole("trainer", "admin"), LMSInstructorController.getMyEnrollments);
router.get ("/instructor/courses/:courseId/analytics",        requireAuth, requireRole("trainer", "admin"), LMSInstructorController.getCourseAnalytics);
router.post("/instructor/upload-video",                       requireAuth, requireRole("trainer", "admin"), LMSInstructorController.uploadVideo);
router.post("/instructor/upload-document",                    requireAuth, requireRole("trainer", "admin"), LMSInstructorController.uploadDocument);
router.get ("/instructor/qa",                                 requireAuth, requireRole("trainer", "admin"), LMSInstructorController.getInstructorQA);
router.put ("/quiz/attempt/:attemptId/grade-essay",           requireAuth, requireRole("trainer", "admin"), LMSQuizController.gradeEssay);

// =============================================
// ADMIN: Quản lý users
// =============================================
router.get   ("/admin/users",     requireAuth, requireRole("admin"), LMSAdminController.listUsers);
router.post  ("/admin/users",     requireAuth, requireRole("admin"), LMSAuthController.createUser);
router.get   ("/admin/users/:id", requireAuth, requireRole("admin"), LMSAdminController.getUserDetail);
router.put   ("/admin/users/:id", requireAuth, requireRole("admin"), LMSAdminController.updateUser);
router.delete("/admin/users/:id", requireAuth, requireRole("admin"), LMSAdminController.deleteUser);

// =============================================
// ADMIN: Quản lý khóa học
// =============================================
router.post  ("/admin/courses",            requireAuth, requireRole("admin", "trainer"), LMSAdminController.createCourse);
router.put   ("/admin/courses/:id",        requireAuth, requireRole("admin", "trainer"), LMSAdminController.updateCourse);
router.delete("/admin/courses/:id",        requireAuth, requireRole("admin"),            LMSAdminController.deleteCourse);
router.get   ("/admin/courses",            requireAuth, requireRole("admin"),            LMSAdminController.listAllCourses);
router.put   ("/admin/courses/:id/approve",requireAuth, requireRole("admin"),            LMSAdminController.approveCourse);
router.put   ("/admin/courses/:id/reject", requireAuth, requireRole("admin"),            LMSAdminController.rejectCourse);

// =============================================
// ADMIN: Sections & Activities
// =============================================
router.post  ("/admin/sections",     requireAuth, requireRole("admin", "trainer"), LMSAdminController.createSection);
router.put   ("/admin/sections/:id", requireAuth, requireRole("admin", "trainer"), LMSAdminController.updateSection);
router.delete("/admin/sections/:id", requireAuth, requireRole("admin", "trainer"), LMSAdminController.deleteSection);

router.post  ("/admin/activities",     requireAuth, requireRole("admin", "trainer"), LMSAdminController.createActivity);
router.put   ("/admin/activities/:id", requireAuth, requireRole("admin", "trainer"), LMSAdminController.updateActivity);
router.delete("/admin/activities/:id", requireAuth, requireRole("admin", "trainer"), LMSAdminController.deleteActivity);

// =============================================
// ADMIN: Zoom Meetings
// =============================================
router.post  ("/admin/zoom-meetings",     requireAuth, requireRole("admin", "trainer"), LMSAdminController.createZoomMeeting);
router.delete("/admin/zoom-meetings/:id", requireAuth, requireRole("admin", "trainer"), LMSAdminController.deleteZoomMeeting);

// =============================================
// ADMIN: Categories
// =============================================
router.get   ("/admin/categories",     requireAuth, requireRole("admin"), LMSAdminController.listCategories);
router.post  ("/admin/categories",     requireAuth, requireRole("admin"), LMSAdminController.createCategory);
router.put   ("/admin/categories/:id", requireAuth, requireRole("admin"), LMSAdminController.updateCategory);
router.delete("/admin/categories/:id", requireAuth, requireRole("admin"), LMSAdminController.deleteCategory);

// =============================================
// ADMIN: Coupons
// =============================================
router.get   ("/admin/coupons",     requireAuth, requireRole("admin"), LMSAdminController.listCoupons);
router.post  ("/admin/coupons",     requireAuth, requireRole("admin"), LMSAdminController.createCoupon);
router.put   ("/admin/coupons/:id", requireAuth, requireRole("admin"), LMSAdminController.updateCoupon);
router.delete("/admin/coupons/:id", requireAuth, requireRole("admin"), LMSAdminController.deleteCoupon);

// =============================================
// ADMIN: Orders
// =============================================
router.get("/admin/orders",           requireAuth, requireRole("admin"), LMSAdminController.listOrders);
router.get("/admin/orders/:id",       requireAuth, requireRole("admin"), LMSAdminController.getOrderDetail);
router.put("/admin/orders/:id/refund",requireAuth, requireRole("admin"), LMSAdminController.refundOrder);

// =============================================
// ADMIN: Banners
// =============================================
router.get   ("/admin/banners",     requireAuth, requireRole("admin"), LMSAdminController.listBanners);
router.post  ("/admin/banners",     requireAuth, requireRole("admin"), LMSAdminController.createBanner);
router.put   ("/admin/banners/:id", requireAuth, requireRole("admin"), LMSAdminController.updateBanner);
router.delete("/admin/banners/:id", requireAuth, requireRole("admin"), LMSAdminController.deleteBanner);

// =============================================
// ADMIN: Stats & Certificates
// =============================================
router.get("/admin/stats",        requireAuth, requireRole("admin"), LMSAdminController.getStats);
router.get("/admin/certificates", requireAuth, requireRole("admin"), LMSAdminController.listCertificates);

// =============================================
// ADMIN/TRAINER: Quiz management
// =============================================
router.post("/admin/quizzes",     requireAuth, requireRole("admin", "trainer"), LMSQuizController.createQuiz);
router.put ("/admin/quizzes/:id", requireAuth, requireRole("admin", "trainer"), LMSQuizController.updateQuiz);
router.get ("/admin/quizzes/:id", requireAuth, requireRole("admin", "trainer"), LMSQuizController.getQuizAdmin);

module.exports = router;
