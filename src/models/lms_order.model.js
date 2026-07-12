const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSOrder";
const COLLECTION_NAME = "LMSOrders";

const lmsOrderSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "LMSUser", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    originalPrice: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    finalPrice: { type: Number, required: true },
    coupon: { type: Types.ObjectId, ref: "LMSCoupon", default: null },
    paymentMethod: {
      type: String,
      enum: ["mock", "vnpay", "momo"],
      default: "mock",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: { type: String },
    paidAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsOrderSchema);
