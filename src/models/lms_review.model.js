const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSReview";
const COLLECTION_NAME = "LMSReviews";

const lmsReviewSchema = new Schema(
  {
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    student: { type: Types.ObjectId, ref: "LMSUser", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

// Đảm bảo mỗi học viên chỉ đánh giá 1 khóa học 1 lần
lmsReviewSchema.index({ course: 1, student: 1 }, { unique: true });

module.exports = model(DOCUMENT_NAME, lmsReviewSchema);
