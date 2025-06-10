const { Schema, model } = require('mongoose');

const timekeepingSchema = new Schema({
  userId: { type: String, required: true },
  timeLogs: [
    {
      status: { type: String, enum: ['IN', 'OUT'], required: true },
      date: { type: Date, default: Date.now },
      ip: { type: String, required: true },
      location: { type: String },
      gpsCoordinates: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
    },
  ],
}, {
  timestamps: true,  // Lưu thêm thời gian tạo và cập nhật bản ghi
});

module.exports = model('Timekeeping', timekeepingSchema);
