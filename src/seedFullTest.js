/**
 * Seed full LMS test data - End to End
 * Tạo: 3 users thật + khóa học + zoom meeting + enroll học viên
 * Usage: node src/seedFullTest.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const LMSUser        = require('./models/lms_user.model');
const LMSCourse      = require('./models/lms_course.model');
const LMSSection     = require('./models/lms_section.model');
const LMSActivity    = require('./models/lms_activity.model');
const LMSZoomMeeting = require('./models/lms_zoom_meeting.model');
const LMSEnrollment  = require('./models/lms_enrollment.model');
const LMSProgress    = require('./models/lms_progress.model');
const LMSRecording   = require('./models/lms_recording.model');

const dbURI = process.env.URL_CLOUD_MONGO ||
  'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(dbURI);
  console.log('✅ Connected to MongoDB\n');

  // ══════════════════════════════════════════════
  // 1. CLEAR ALL LMS DATA
  // ══════════════════════════════════════════════
  await LMSRecording.deleteMany({});
  await LMSProgress.deleteMany({});
  await LMSEnrollment.deleteMany({});
  await LMSActivity.deleteMany({});
  await LMSSection.deleteMany({});
  await LMSZoomMeeting.deleteMany({});
  await LMSCourse.deleteMany({});
  await LMSUser.deleteMany({});
  console.log('🗑  Đã xóa dữ liệu LMS cũ\n');

  // ══════════════════════════════════════════════
  // 2. TẠO 3 USERS THẬT
  // ══════════════════════════════════════════════
  const adminUser = new LMSUser({
    fullName: 'Admin Hệ Thống',
    email: 'ducprokb1234@gmail.com',
    password: '1',
    role: 'admin',
    phone: '0900000001',
  });
  await adminUser.save();

  const trainerUser = new LMSUser({
    fullName: 'Nguyễn Văn Đào Tạo',
    email: 'ducprokb123@gmail.com',
    password: '1',
    role: 'trainer',
    phone: '0900000002',
  });
  await trainerUser.save();

  const studentUser = new LMSUser({
    fullName: 'Trần Thị Học Viên',
    email: 'ducprokb12@gmail.com',
    password: '1',
    role: 'student',
    phone: '0900000003',
  });
  await studentUser.save();

  console.log('👥 Đã tạo 3 users:');
  console.log(`   👑 Admin   : ducprokb1234@gmail.com / 1  (ID: ${adminUser._id})`);
  console.log(`   🎓 Trainer : ducprokb123@gmail.com  / 1  (ID: ${trainerUser._id})`);
  console.log(`   📚 Student : ducprokb12@gmail.com   / 1  (ID: ${studentUser._id})\n`);

  // ══════════════════════════════════════════════
  // 3. TẠO ZOOM MEETING (sắp diễn ra)
  // ══════════════════════════════════════════════
  const zoomMeeting = await LMSZoomMeeting.create({
    topic: 'Buổi học Yoga trực tiếp - Hỏi đáp & Thực hành',
    meetingId: '85312345678',
    passcode: '123456',
    startUrl: 'https://zoom.us/s/85312345678?zak=test',
    joinUrl: 'https://zoom.us/j/85312345678?pwd=test',
    startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 phút nữa
    duration: 90, // 90 phút
    host: trainerUser._id,
  });
  console.log(`📹 Zoom Meeting: "${zoomMeeting.topic}"`);
  console.log(`   Meeting ID: ${zoomMeeting.meetingId} | Bắt đầu sau 30 phút\n`);

  // ══════════════════════════════════════════════
  // 4. TẠO KHÓA HỌC
  // ══════════════════════════════════════════════
  const course = await LMSCourse.create({
    title: 'Yoga & Thiền Định Cơ Bản 200H',
    slug: 'yoga-thien-dinh-200h',
    description: 'Khóa học yoga và thiền định cho người mới bắt đầu. Gồm video bài giảng, tài liệu PDF và buổi học trực tiếp qua Zoom.',
    instructor: trainerUser._id,
    price: 2500000,
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600',
    status: 'published',
    settings: { dripFeed: false, certificateEnabled: true },
  });

  // ── Chương 1: Học liệu online ──
  const section1 = await LMSSection.create({
    title: 'Chương 1: Học liệu Online',
    course: course._id,
    order: 1,
    status: 'published',
  });

  const act_video1 = await LMSActivity.create({
    title: 'Bài 1: Giới thiệu Yoga & lợi ích sức khỏe',
    type: 'video',
    section: section1._id,
    order: 1,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  const act_video2 = await LMSActivity.create({
    title: 'Bài 2: 5 Tư thế Yoga cơ bản (Asana)',
    type: 'video',
    section: section1._id,
    order: 2,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  const act_pdf = await LMSActivity.create({
    title: 'Tài liệu: Hướng dẫn tư thế chuẩn (PDF)',
    type: 'pdf',
    section: section1._id,
    order: 3,
    status: 'published',
    content: { pdfUrl: 'https://www.africau.edu/images/default/sample.pdf' },
  });

  const act_text = await LMSActivity.create({
    title: 'Ghi chú: Tóm tắt bài học',
    type: 'text',
    section: section1._id,
    order: 4,
    status: 'published',
    content: {
      textContent: `
        <h2>📝 Tóm tắt Chương 1</h2>
        <p>Bạn đã học được các tư thế cơ bản trong tuần đầu:</p>
        <ul>
          <li>🧘 Tư thế Núi (Tadasana)</li>
          <li>🧘 Tư thế Chiến binh I (Virabhadrasana I)</li>
          <li>🧘 Tư thế Hạ Khuyển (Adho Mukha Svanasana)</li>
        </ul>
        <p><strong>Bài tập:</strong> Thực hành mỗi sáng 15 phút trước khi ăn sáng.</p>
      `
    },
  });

  section1.activities = [act_video1._id, act_video2._id, act_pdf._id, act_text._id];
  await section1.save();

  // ── Chương 2: Học trực tiếp qua Zoom ──
  const section2 = await LMSSection.create({
    title: 'Chương 2: Lớp học Trực tiếp (Zoom Live)',
    course: course._id,
    order: 2,
    status: 'published',
  });

  const act_zoom = await LMSActivity.create({
    title: '🎥 LIVE: Hỏi đáp & Thực hành cùng giảng viên',
    type: 'zoom_meeting',
    section: section2._id,
    order: 1,
    status: 'published',
    content: { zoomMeetingId: zoomMeeting._id },
  });

  section2.activities = [act_zoom._id];
  await section2.save();

  course.sections = [section1._id, section2._id];
  await course.save();

  console.log(`📚 Khóa học: "${course.title}" (ID: ${course._id})`);
  console.log(`   Chương 1: ${section1.activities.length} bài học (Video, PDF, Text)`);
  console.log(`   Chương 2: 1 buổi Zoom Live\n`);

  // ══════════════════════════════════════════════
  // 5. ENROLL HỌC VIÊN VÀO KHÓA HỌC
  // ══════════════════════════════════════════════
  await LMSEnrollment.create({
    student: studentUser._id,
    course: course._id,
    status: 'active',
    paymentAmount: 2500000,
    paymentMethod: 'bank_transfer',
  });

  // Học viên đã hoàn thành bài 1 và 2
  await LMSProgress.create({
    student: studentUser._id,
    course: course._id,
    completedActivities: [act_video1._id, act_video2._id],
    overallProgress: 40,
  });

  console.log(`🎓 Học viên "${studentUser.fullName}" đã được enroll vào khóa học`);
  console.log(`   Tiến độ: 40% (đã hoàn thành 2/5 bài)\n`);

  // ══════════════════════════════════════════════
  // 6. IN THÔNG TIN TEST
  // ══════════════════════════════════════════════
  console.log('═'.repeat(55));
  console.log('  ✅ SEED XONG - SẴN SÀNG TEST!');
  console.log('═'.repeat(55));
  console.log('\n🌐 Frontend: http://localhost:5173');
  console.log('\n🔐 Tài khoản đăng nhập:');
  console.log('   👑 Admin   : ducprokb1234@gmail.com / 1');
  console.log('   🎓 Trainer : ducprokb123@gmail.com  / 1');
  console.log('   📚 Student : ducprokb12@gmail.com   / 1');
  console.log('\n📋 Thông tin khóa học:');
  console.log(`   Course ID : ${course._id}`);
  console.log(`   Zoom ID   : ${zoomMeeting.meetingId}`);
  console.log('\n🧪 Test Zoom Recording (cục bộ):');
  console.log('   npm run test:zoom');
  console.log('   → Sau đó vào /recordings để xem kết quả\n');
  console.log('═'.repeat(55));

  // Lưu thông tin vào file để test:zoom dùng
  const fs = require('fs');
  const testInfo = {
    courseId: course._id.toString(),
    zoomMeetingId: zoomMeeting.meetingId,
    studentId: studentUser._id.toString(),
    trainerId: trainerUser._id.toString(),
    adminId: adminUser._id.toString(),
  };
  fs.writeFileSync('./src/.test-info.json', JSON.stringify(testInfo, null, 2));
  console.log('💾 Đã lưu test info vào src/.test-info.json\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
