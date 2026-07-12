/**
 * Test Zoom Webhook cục bộ (Local)
 * Giả lập Zoom gọi về backend khi recording hoàn tất
 * Usage: node src/testZoomWebhook.js
 */
require('dotenv').config();
const http = require('http');
const fs   = require('fs');

const PORT = process.env.PORT || 3056;

// Đọc thông tin từ seedFullTest nếu có
let testInfo = {};
try {
  testInfo = JSON.parse(fs.readFileSync('./src/.test-info.json', 'utf8'));
} catch (e) { /* dùng giá trị mặc định */ }

const meetingId = testInfo.zoomMeetingId || '85312345678';

const fakePayload = {
  event: "recording.completed",
  payload: {
    object: {
      id: meetingId,
      topic: "Buổi học Yoga trực tiếp - Hỏi đáp & Thực hành",
      host_email: "ducprokb123@gmail.com",
      start_time: new Date(Date.now() - 3600000).toISOString(), // 1 giờ trước
      duration: 60, // phút
      recording_files: [
        {
          recording_type: "shared_screen_with_speaker_view",
          download_url: "https://zoom.us/rec/download/test_recording_abc123",
          play_url: "https://zoom.us/rec/play/test_recording_abc123",
          file_size: 52428800, // 50MB
          recording_end: new Date().toISOString(),
        },
        {
          recording_type: "audio_only",
          download_url: "https://zoom.us/rec/download/test_audio_abc123",
          play_url: "https://zoom.us/rec/play/test_audio_abc123",
          file_size: 5242880, // 5MB
          recording_end: new Date().toISOString(),
        }
      ]
    }
  }
};

const crypto = require('crypto');
const ZOOM_WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET;

const body = JSON.stringify(fakePayload);
const timestamp = Date.now().toString();
let signature = '';

if (ZOOM_WEBHOOK_SECRET) {
  const message = `v0:${timestamp}:${body}`;
  const hash = crypto.createHmac('sha256', ZOOM_WEBHOOK_SECRET).update(message).digest('hex');
  signature = `v0=${hash}`;
}

const options = {
  hostname: '127.0.0.1',
  port: PORT,
  path: '/api/lms/zoom/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...(signature ? {
      'x-zm-signature': signature,
      'x-zm-request-timestamp': timestamp
    } : {})
  },
};

console.log(`\n Gửi fake Zoom webhook đến http://localhost:${PORT}/api/lms/zoom/webhook`);
console.log(' Event: recording.completed');
console.log(' Meeting: 85312345678 -', fakePayload.payload.object.topic);
console.log(' Files:', fakePayload.payload.object.recording_files.length, 'recording(s)\n');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.success) {
      console.log(`✅ THÀNH CÔNG! Đã lưu ${result.saved} recording(s) vào DB`);
      console.log('\n👉 Kiểm tra tại: http://localhost:5173/recordings');
    } else {
      console.log('❌ Lỗi:', result.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Không thể kết nối tới Backend:', e.message);
  console.error('   → Hãy chắc chắn Backend đang chạy: npm start');
});

req.write(body);
req.end();
