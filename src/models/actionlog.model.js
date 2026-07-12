const { model, Schema, Types } = require("mongoose");

// Schema cho bảng ActionLog
const actionLogSchema = new Schema(
  {
    entityId: {
      type: Types.ObjectId,
      required: true,
      refPath: "entity", // Tham chiếu động đến các entity như Contact, Pipeline
    },
    entity: {
      type: String,
      required: true,
      enum: ["Contact", "Pipeline"], // Liệt kê các entity cần theo dõi
    },
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE", "UPDATE_INSTALLMENT"],
      required: true,
    },
    oldValue: {
      type: Schema.Types.Mixed, // Lưu trữ giá trị cũ của entity
      required: false,
    },
    newValue: {
      type: Schema.Types.Mixed, // Lưu trữ giá trị mới của entity
      required: false,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: "User", // Tham chiếu người dùng đã thực hiện hành động
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now, // Thời gian log được tạo
    },
  },
  {
    timestamps: true,
    collection: "ActionLogs",
  }
);

module.exports = model("ActionLog", actionLogSchema);
