const { model, Schema, Types } = require("mongoose");
const autoIncrement = require("mongoose-sequence")(require("mongoose"));

// Schema cho bảng Pipeline
const pipelineSchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "Contact",
      required: true,
    },
    stage: {
      type: String,
      enum: [
        "Quan tâm/tiềm năng",
        "Đang tìm hiểu",
        "Gởi báo giá",
        "Đang cân nhắc",
        "Chốt Deal",
        "Hoàn tất thu tiền",
        "Đang cân nhắc",
        "Deal chưa thành công",
        "Khách hàng của affiliate",
      ],
      required: false,
    },
    contact: { type: Types.ObjectId, ref: "Contact", required: true },
    amountTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    Firstpayment: {
      type: Number,
      required: true,
      default: 0,
    },
    voucherType: {
      type: String,
      enum: ["Percent", "Amount"],
    },
    voucherInt: {
      type: Number,
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    PaymentType: {
      type: String,
      enum: ["Full", "Install"],
      default: "Full",
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    expectedCloseDate: { type: Date },
    notes: { type: String, required: false },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    products: [
      {
        type: Types.ObjectId,
        ref: "Product",
      },
    ],
    K: [
      {
        product: { type: Types.ObjectId, ref: "Product", required: true },
        value: { type: String, required: false },
      },
    ],
    orderCode: {
      type: Number,
      unique: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Installment", "Completed", "Cancelled"],
      default: "Pending",
    },
    surcharge: {
      type: Number,
      default: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
      },
    ],
    isAffiliate: {
      type: Boolean,
      required: false,
      default: false,
    },
    // ✅ THÊM MỚI: Đối tác kinh doanh
    isBusinessPartner: {
      type: Boolean,
      required: false,
      default: false, // Mặc định là false (không phải đối tác kinh doanh)
    },
    // Thông tin các đợt trả góp
    installments: [
      {
        installmentNumber: { type: Number, required: true }, // Lần 1, lần 2...
        amount: { type: Number, required: true }, // Số tiền cần trả
        expectedDate: { type: Date, required: true }, // Ngày dự kiến trả
        isPaid: { type: Boolean, default: false }, // Đã thanh toán chưa
        actualPaymentDate: { type: Date }, // Ngày thanh toán thực tế
        isEmailSent: { type: Boolean, default: false }, // Cờ kiểm tra đã gửi email nhắc nhở chưa
      }
    ],
    // ✅ Cờ xác nhận KT đã thu tiền đầu (Firstpayment)
    // false = chưa duyệt lần nào, true = đã xác nhận tiền đầu rồi
    firstPaymentConfirmed: {
      type: Boolean,
      default: false,
    },
    paymentInfo: {
      transactionId: { type: String },
      cassoTransactionId: { type: String },
      amount: { type: Number },
      paymentDate: { type: Date },
      description: { type: String },
      cusum_balance: { type: Number },
    },
    // Tracking for expiry reminders (1 month, 10 days, 1 day before)
    expiryEmailReminders: {
      reminded1Month: { type: Boolean, default: false },
      reminded10Days: { type: Boolean, default: false },
      reminded1Day: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    collection: "Pipelines",
  }
);

// Tự động tăng orderCode
pipelineSchema.plugin(autoIncrement, { inc_field: "orderCode", start_seq: 0 });

module.exports = model("Pipeline", pipelineSchema);