const { model, Schema, Types } = require("mongoose");

const DOCUMENT_NAME = "Workstream";
const COLLECTION_NAME = "Workstreams";

const workstreamSchema = new Schema(
  {
    title: { type: String, required: true }, // Tên workstream
    description: { type: String, required: true }, // Mô tả workstream
    imageUrl: { type: String, required: false }, // Không bắt buộc
    uploadedBy: { type: Types.ObjectId, ref: "User", required: true }, // Người upload
    likes: [{ type: Types.ObjectId, ref: "User" }], // Danh sách người like
    comments: [
      {
        user: { type: Types.ObjectId, ref: "User", required: true }, // Người bình luận
        text: { type: String, required: true }, // Nội dung bình luận
        createdAt: { type: Date, default: Date.now }, // Thời gian bình luận
      },
    ],
    category: {
      type: String,
      enum: ["important", "campaign"], // Các loại: Tình quan trọng hoặc chiến dịch
      required: true,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, workstreamSchema);
