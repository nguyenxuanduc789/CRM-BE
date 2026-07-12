const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  address: {
    type: String,
    required: false,
  },
  courseName: {
    type: String,
    required: false,
  },
  courseCode: {
    type: String,
    required: false,
  },
  certNumber: {
    type: String,
    required: false,
  },
  issueDate: {
    type: String,
    required: false,
  },
  newCertNumber: {
    type: String,
    required: false,
  },
  studentCode: {
    type: String,
    required: false,
  },
  certificateUrl: {
    type: String,
    required: false,
  }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
