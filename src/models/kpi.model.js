const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const kpiSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true }, // Người được giao KPI
    assignedBy: { type: Types.ObjectId, ref: "User", required: true }, // Người giao KPI
    target: { type: Number, required: true }, // Mục tiêu doanh số
    actual: { type: Number, default: 0 }, // Doanh số thực tế đạt được
    startDate: { type: Date, required: true }, // Ngày bắt đầu áp dụng KPI
    endDate: { type: Date, required: true }, // Ngày kết thúc KPI
    status: {
      type: String,
      enum: ["On Track", "At Risk", "Off Track"],
      default: "On Track",
    },
  },
  {
    timestamps: true,
    collection: "KPIs",
  }
);

module.exports = mongoose.model("KPI", kpiSchema);
