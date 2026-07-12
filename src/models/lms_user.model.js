const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const bcrypt = require("bcryptjs");

const COLLECTION_NAME = "LMSUsers";
const DOCUMENT_NAME = "LMSUser";

const lmsUserSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "trainer", "student"],
      default: "student",
    },
    avatar: { type: String, default: "" },
    phone: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    lastLogin: { type: Date },

    // === Thêm mới ===
    bio: { type: String },
    website: { type: String },
    title: { type: String }, // Chức danh / nghề nghiệp
    totalCourses: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },

    // Đặt lại mật khẩu bằng OTP
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date },

    // Tùy chọn thông báo
    notificationPrefs: {
      email: { type: Boolean, default: true },
      app: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

// Hash password trước khi save
lmsUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// So sánh mật khẩu
lmsUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = model(DOCUMENT_NAME, lmsUserSchema);
