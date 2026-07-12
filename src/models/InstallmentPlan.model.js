const { model, Schema, Types } = require("mongoose");

const installmentPlanSchema = new Schema(
  {
    orderCode: {
      type: Number,
      ref: "Pipeline",
      required: true,
    },
    TotalAmount: { type: Number, required: true },
    PaidAmount: { type: Number, required: true },
    RemainAmount: { type: Number, required: true },
    NoOfPayment: { type: Number, required: true },
    installmentNumber: {
      type: String,
      required: true,
    },
    dueDate: { type: Date }, // Ngày dự kiến trả
    paidAt: { type: Date }, // Ngày đã thanh toán thực tế
    Status: {
      type: String,
      enum: ["pending", "Completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "InstallmentPlans",
  }
);

module.exports = model("InstallmentPlan", installmentPlanSchema);
