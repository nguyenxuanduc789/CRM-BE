const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSEnrollment";
const COLLECTION_NAME = "LMSEnrollments";

const lmsEnrollmentSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "User", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    status: { type: String, enum: ["active", "completed", "expired"], default: "active" },
    enrolledAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }, // null = lifetime access
    paymentAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "free" },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

// Đảm bảo 1 học viên không đăng ký trùng 1 khóa học
lmsEnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = model(DOCUMENT_NAME, lmsEnrollmentSchema);
