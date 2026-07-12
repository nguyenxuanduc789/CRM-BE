const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSQuizAttempt";
const COLLECTION_NAME = "LMSQuizAttempts";

const answerDetailSchema = new Schema(
  {
    questionIndex: { type: Number },
    selectedOptions: [{ type: Number }], // Chỉ số option được chọn
    essayAnswer: { type: String },
    isCorrect: { type: Boolean, default: null }, // null với câu tự luận chưa chấm
    pointsEarned: { type: Number, default: 0 },
  },
  { _id: true }
);

const lmsQuizAttemptSchema = new Schema(
  {
    quiz: { type: Types.ObjectId, ref: "LMSQuiz", required: true },
    student: { type: Types.ObjectId, ref: "LMSUser", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    answers: [answerDetailSchema],
    totalPoints: { type: Number, default: 0 },
    earnedPoints: { type: Number, default: 0 },
    scorePercent: { type: Number, default: 0 },
    isPassed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["in_progress", "submitted", "graded"],
      default: "in_progress",
    },
    submittedAt: { type: Date },
    gradedAt: { type: Date },
    gradedBy: { type: Types.ObjectId, ref: "LMSUser", default: null },
    instructorFeedback: { type: String },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsQuizAttemptSchema);
