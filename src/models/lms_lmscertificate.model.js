const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSCertificate";
const COLLECTION_NAME = "LMSCertificates";

const lmsCertificateSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "LMSUser", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    certificateNumber: { type: String, unique: true, required: true },
    issuedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    totalScore: { type: Number },
    grade: { type: String },
    template: { type: String, default: "default" },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

// Đảm bảo 1 học viên chỉ có 1 chứng chỉ cho mỗi khóa học
lmsCertificateSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = model(DOCUMENT_NAME, lmsCertificateSchema);
