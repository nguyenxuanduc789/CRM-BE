const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "Course";
const COLLECTION_NAME = "Courses";

const courseSchema = new Schema(
  {
    title: { type: String, required: true }, // Tiêu đề của khóa học
    description: { type: String, required: true }, // Mô tả về khóa học
    instructor: { type: Types.ObjectId, ref: "User", required: true }, // Tham chiếu đến giảng viên (User)
    price: { type: Number, required: true }, // Giá của khóa học
    imageUrl: { type: String, required: true }, // URL của hình ảnh khóa học
    videos: [{ type: Types.ObjectId, ref: "Video" }], // Tham chiếu đến các video trong khóa học
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, courseSchema);
