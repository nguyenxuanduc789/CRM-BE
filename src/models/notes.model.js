const { model, Schema, Types } = require("mongoose");

// Schema cho bảng Notes
const noteSchema = new Schema(
  {
    orderCode: {
      type: Number,
      ref: "Pipeline", // Tham chiếu đến Pipeline qua orderCode
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: "User", // Người tạo ghi chú
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
        type: Types.ObjectId,
        ref: "User", 
        required: true,
    },      
  },
  {
    collection: "Notes",
  }
);

module.exports = model("Note", noteSchema);
