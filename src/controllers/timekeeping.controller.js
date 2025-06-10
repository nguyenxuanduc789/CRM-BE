// backend/controllers/timekeepingController.js
const Timekeeping = require('../models/timekeeping.model');
const { checkVPN } = require('../utils/vpnChecker');

// API chấm công
const clockInOut = async (req, res) => {
  const { userId, status, ip, latitude, longitude } = req.body;

  try {
    // Kiểm tra VPN
    const isVPN = await checkVPN(ip);
    if (isVPN) {
      return res.status(400).json({ message: "VPN detected. Cannot clock in/out." });
    }

    // Tìm kiếm bản ghi của userId trong ngày
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const timekeeping = await Timekeeping.findOne({
      userId,
      'timeLogs.date': { $gte: startOfDay, $lte: endOfDay },  // Tìm kiếm trong khoảng thời gian ngày hôm nay
    });

    if (status === 'IN') {
      if (timekeeping && timekeeping.timeLogs.some(log => log.status === 'IN')) {
        return res.status(400).json({ message: "Already clocked in today." });
      }
      // Nếu chưa có "IN", tạo mới bản ghi "IN"
      const newTimekeeping = new Timekeeping({
        userId,
        timeLogs: [{
          status: 'IN',
          date: new Date(),
          ip,
          location: `${latitude}, ${longitude}`,
          gpsCoordinates: { latitude, longitude },
        }],
      });

      await newTimekeeping.save();
      return res.status(200).json({ message: "Clocked in successfully!" });
    }

    if (status === 'OUT') {
      if (!timekeeping || !timekeeping.timeLogs.some(log => log.status === 'IN')) {
        return res.status(400).json({ message: "Cannot clock out before clocking in." });
      }
      
      // Cập nhật trạng thái "OUT" vào mảng timeLogs
      timekeeping.timeLogs.push({
        status: 'OUT',
        date: new Date(),
        ip,
        location: `${latitude}, ${longitude}`,
        gpsCoordinates: { latitude, longitude },
      });

      await timekeeping.save();
      return res.status(200).json({ message: "Clocked out successfully!" });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while recording timekeeping." });
  }
};
const getTimekeepingData = async (req, res) => {
  const { userId } = req.query; // Thay vì req.params, sử dụng req.query
  try {
    // Find timekeeping logs for a specific user
    const timekeepingData = await Timekeeping.find({ userId }).sort({ 'timeLogs.date': 1 });

    if (!timekeepingData || timekeepingData.length === 0) {
      return res.status(404).json({ message: 'No timekeeping data found for this user' });
    }

    // Extract and format the logs
    const timeLogs = timekeepingData[0].timeLogs.map(log => ({
      status: log.status,
      date: new Date(log.date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      ip: log.ip,
      location: log.location,
    }));

    res.status(200).json({ timeLogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching timekeeping data' });
  }
};



module.exports = {
  clockInOut,
  getTimekeepingData ,
};
