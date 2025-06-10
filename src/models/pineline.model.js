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
      enum: ["Percent", "Amount"], // Loại voucher: giảm theo phần trăm hoặc số tiền
    },
    voucherInt: {
      type: Number,
    },
    depositAmount: {
      type: Number,
      default: 0, // Số tiền tạm ứng
    },
    PaymentType: {
      type: String,
      enum: ["Full", "Install"], // Loại voucher: giảm theo phần trăm hoặc số tiền
      default: "Full",
    },
    totalAmount: {
      type: Number,

      default: 0,
    },
    expectedCloseDate: { type: Date }, // Ngày dự kiến đóng giao dịch
    notes: { type: String, required: false },
    createdBy: { type: Types.ObjectId, ref: "User", required: true }, // Người tạo pipeline
    products: [
      {
        type: Types.ObjectId,
        ref: "Product",
      },
    ],
    K: [
      {
        product: { type: Types.ObjectId, ref: "Product", required: true }, // ID sản phẩm
        value: { type: String, required: true }, // Giá trị liên quan đến sản phẩm
      },
    ], // Mảng chứa các thông tin K liên quan đến products
    orderCode: {
      type: Number,
      unique: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Installment", "Completed", "Cancelled"], // Giá trị cố định cho status
      default: "Pending", // Giá trị mặc định
    },
    images: [
      {
        url: { type: String, required: true }, // Đường dẫn ảnh
        filename: { type: String, required: true }, // Tên file ảnh
      },
    ],
    isAffiliate: {
      type: Boolean,
      required: false,
      default: false, // Mặc định là false (không phải affiliate)
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
