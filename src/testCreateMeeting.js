require('dotenv').config();
const ZoomService = require('./services/zoom.service');

async function test() {
  console.log('Testing Zoom Meeting Creation via API...');
  try {
    const meeting = await ZoomService.createZoomMeeting({
      topic: 'Lớp Học Yoga Trực Tuyến Test API',
      startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins from now
      duration: 60,
      passcode: '123456'
    });

    console.log('✅ THÀNH CÔNG! Đã tạo cuộc họp thật trên Zoom:');
    console.log('Meeting ID:', meeting.meetingId);
    console.log('Mật mã:', meeting.passcode);
    console.log('Link bắt đầu (Host):', meeting.startUrl);
    console.log('Link tham gia (Join):', meeting.joinUrl);
  } catch (error) {
    console.error('❌ Lỗi tạo cuộc họp:', error.message);
  }
}

test();
