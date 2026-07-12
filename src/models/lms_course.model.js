const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSCourse";
const COLLECTION_NAME = "LMSCourses";

const lmsCourseSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    description: { type: String },
    instructor: { type: Types.ObjectId, ref: "LMSUser", required: true },
    price: { type: Number, default: 0 },
    imageUrl: { type: String },
    status: { type: String, enum: ["draft", "published", "private"], default: "draft" },
    settings: {
      dripFeed: { type: Boolean, default: false },
      certificateEnabled: { type: Boolean, default: false },
    },
    sections: [{ type: Types.ObjectId, ref: "LMSSection" }],

    // === Thêm mới ===
    category: { type: Types.ObjectId, ref: "LMSCategory", default: null },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    language: { type: String, default: "vi" },
    tags: [{ type: String }],
    requirements: [{ type: String }],
    objectives: [{ type: String }],
    totalStudents: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }, // Phút
    isApproved: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    previewVideoUrl: { type: String },
    thumbnail: { type: String },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, lmsCourseSchema);
