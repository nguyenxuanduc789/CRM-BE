const { model, Schema, Types } = require("mongoose");

const emailLogSchema = new Schema({
 
  // Thông tin người nhận
  to: {
    type: String,
    required: true,
  },
  cc: [{
    type: String,
  }],

  // Nội dung email
  subject: {
    type: String,
    required: true,
  },
  html: {
    type: String,                   // Nội dung HTML đầy đủ
  },
  text: {
    type: String,                   // Phiên bản text thuần (fallback)
  },

  // Trạng thái gửi
  status: {
    type: String,
    enum: ["sent", "failed", "queued"],
    default: "sent",
  },
  messageId: String,                // Message-ID từ mail server
  errorMessage: String,             // Nếu gửi thất bại thì lưu lỗi

  // Người gửi (user nào trong hệ thống gửi email này)


  // Metadata bổ sung
  type: {
    type: String,
    enum: ["welcome", "custom", "followup", "reminder", "other"],
    default: "custom",
  },

  sentAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,                 // Tự động có createdAt, updatedAt
});

// Index để query nhanh
emailLogSchema.index({ contact: 1, sentAt: -1 });
emailLogSchema.index({ sentBy: 1, sentAt: -1 });

module.exports = model("EmailLog", emailLogSchema);