const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSProgress";
const COLLECTION_NAME = "LMSProgresses";

const lmsProgressSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "User", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    completedActivities: [{ type: Types.ObjectId, ref: "LMSActivity" }],
    // Lưu chi tiết trạng thái từng bài
    activityDetails: [
      {
        activity: { type: Types.ObjectId, ref: "LMSActivity" },
        status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },
        watchTime: { type: Number, default: 0 }, // Seconds (for videos)
        score: { type: Number }, // For quizzes
        lastAccessed: { type: Date, default: Date.now },
      }
    ],
    overallProgress: { type: Number, default: 0 }, // 0 - 100%
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

// Compound index cho student và course
lmsProgressSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = model(DOCUMENT_NAME, lmsProgressSchema);
