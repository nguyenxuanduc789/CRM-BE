// models/Contact.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  idaca: {
    type: String,
    required: true,
    unique: true, // Đảm bảo idaca là duy nhất
    trim: true,
  },
  namecusaca: {
    type: String,
    //required: true,
    trim: true,
  },
  NguoiGT: {
    type: String,
    default: '', // Không bắt buộc, mặc định là chuỗi rỗng
    trim: true,
  },
  phonecusaca: {
    type: String,
    //required: true,
    //match: [/^\d{10,11}$/, 'Số điện thoại phải có 10-11 chữ số'], // Kiểm tra định dạng số điện thoại
    trim: true,
  },
  emailcusaca: {
    type: String,
    ///required: true,
    //match: [/.+\@.+\..+/, 'Email không hợp lệ'], // Kiểm tra định dạng email
    trim: true,
  },
  Typesource: {
    type: [String], // Mảng các chuỗi để chứa nhiều giá trị
    //required: true, // Bắt buộc
    default: [], // Mặc định là mảng rỗng
  },
  dateOfBirth: {
    type: String, // Có thể dùng Date nếu muốn chuẩn hóa
    trim: true,
    default: '',
  },
  gender: {
    type: String,
    trim: true,
    default: '',
  },
  address: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true, // Tự động thêm createdAt và updatedAt
});

module.exports = mongoose.model('Contact Portal', contactSchema);