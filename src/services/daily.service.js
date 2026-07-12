const axios = require('axios');

class DailyService {
  /**
   * Tạo phòng học trực tuyến mới trên Jitsi Meet
   */
  static async createRoom({ topic, duration }) {
    // Tạo tên phòng độc nhất bằng tiếng Anh viết liền để không bị lỗi URL Jitsi
    const roomName = 'KhitamLMS_' + Math.floor(100000 + Math.random() * 900000);
    // Sử dụng máy chủ công cộng của Jitsi Meet (Miễn phí hoàn toàn)
    const jitsiUrl = `https://meet.jit.si/${roomName}#config.startWithAudioMuted=true&config.startWithVideoMuted=true`;
    
    console.log('🔮 Đang tạo phòng học Jitsi Meet:', jitsiUrl);
    return {
      name: roomName,
      url: jitsiUrl,
      createdAt: new Date()
    };
  }

  /**
   * Xóa phòng học trực tuyến (Jitsi Meet tự hủy phòng khi không còn ai, không cần API)
   */
  static async deleteRoom(roomName) {
    return true;
  }
}

module.exports = DailyService;
