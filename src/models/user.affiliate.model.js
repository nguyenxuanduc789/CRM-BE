const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const affiliateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên là bắt buộc'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email là bắt buộc'],
    unique: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Vui lòng nhập email hợp lệ'],
  },
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
  },
  affiliateId: {
    type: String,
    required: [true, 'Mã Affiliate ID là bắt buộc'],
    unique: true,
    trim: true,
    match: [/^[a-zA-Z0-9_-]+$/, 'Mã Affiliate ID chỉ được chứa chữ cái, số, dấu gạch dưới hoặc dấu gạch ngang'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Mã hóa mật khẩu trước khi lưu
affiliateSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// So sánh mật khẩu khi đăng nhập
affiliateSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Affiliate = mongoose.model('User Affiliate', affiliateSchema);
module.exports = Affiliate;