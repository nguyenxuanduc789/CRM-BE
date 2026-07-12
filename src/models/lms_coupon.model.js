const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSCoupon";
const COLLECTION_NAME = "LMSCoupons";

const lmsCouponSchema = new Schema(
  {
    code: { type: String, unique: true, required: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ["percent", "fixed"], required: true },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    maxUses: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    // Nếu rỗng thì áp dụng cho tất cả khóa học
    courses: [{ type: Types.ObjectId, ref: "LMSCourse" }],
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsCouponSchema);
