const axios = require('axios');

class ZoomService {
  /**
   * Lấy Access Token từ Zoom bằng Server-to-Server OAuth
   */
  static async getAccessToken() {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      return null; // Không có credentials
    }

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
        null,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return response.data.access_token;
    } catch (error) {
      console.error('❌ Lỗi lấy Zoom Access Token:', error.response?.data || error.message);
      throw new Error('Không thể kết nối API Zoom. Vui lòng kiểm tra lại Account ID, Client ID, Client Secret.');
    }
  }

  /**
   * Tạo cuộc họp Zoom tự động
   */
  static async createZoomMeeting({ topic, startTime, duration, passcode }) {
    const token = await this.getAccessToken();
    if (!token) {
      // Fallback khi chạy offline không có config Zoom API
      console.log('⚠️ Không tìm thấy cấu hình ZOOM API. Tạo lớp học dạng Offline/Giả lập.');
      const mockMeetingId = '853' + Math.floor(10000000 + Math.random() * 90000000);
      return {
        meetingId: mockMeetingId,
        passcode: passcode || '123456',
        startUrl: `https://zoom.us/s/${mockMeetingId}?zak=mock_token`,
        joinUrl: `https://zoom.us/j/${mockMeetingId}?pwd=mock_password`,
      };
    }

    try {
      // Zoom API tạo meeting: https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic: topic,
          type: 2, // Scheduled meeting
          start_time: new Date(startTime).toISOString(),
          duration: duration || 60,
          timezone: 'Asia/Ho_Chi_Minh',
          password: passcode || '123456',
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: true,
            mute_upon_entry: false,
            waiting_room: false,
            auto_recording: 'cloud', // Tự động ghi hình lên Cloud để lưu record!
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;
      return {
        meetingId: data.id.toString(),
        passcode: data.password || passcode,
        startUrl: data.start_url,
        joinUrl: data.join_url,
      };
    } catch (error) {
      console.error('❌ Lỗi tạo Meeting trên Zoom:', error.response?.data || error.message);
      throw new Error('Lỗi từ Zoom API: ' + (error.response?.data?.message || error.message));
    }
  }
}

module.exports = ZoomService;
