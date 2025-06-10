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
      // Trường mới thêm vào
      type: String,
      required: true,
    },
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
