/**
 * Seed data LMS - Tạo dữ liệu mẫu để test
 * Usage: node src/seedLMS.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const LMSCourse    = require('./models/lms_course.model');
const LMSSection   = require('./models/lms_section.model');
const LMSActivity  = require('./models/lms_activity.model');
const LMSZoomMeeting = require('./models/lms_zoom_meeting.model');
const LMSEnrollment  = require('./models/lms_enrollment.model');
const LMSProgress    = require('./models/lms_progress.model');

const dbURI = process.env.URL_CLOUD_MONGO ||
  'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

const FAKE_INSTRUCTOR_ID = new mongoose.Types.ObjectId('64a1111111111111111111a1');
const FAKE_STUDENT_ID    = new mongoose.Types.ObjectId('64a2222222222222222222b2');

async function seed() {
  await mongoose.connect(dbURI);
  console.log('✅ Connected to MongoDB');

  await LMSProgress.deleteMany({});
  await LMSEnrollment.deleteMany({});
  await LMSActivity.deleteMany({});
  await LMSSection.deleteMany({});
  await LMSZoomMeeting.deleteMany({});
  await LMSCourse.deleteMany({});
  console.log('Cleared old LMS data');

  const zoom1 = await LMSZoomMeeting.create({
    topic: 'Buổi học trực tiếp tuần 1 - Hỏi đáp',
    meetingId: '81234567890',
    passcode: '123456',
    startUrl: 'https://zoom.us/s/81234567890',
    joinUrl: 'https://zoom.us/j/81234567890',
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    duration: 90,
    host: FAKE_INSTRUCTOR_ID,
  });
  console.log('Zoom meeting created:', zoom1.meetingId);

  // KHOA HOC 1
  const course1 = await LMSCourse.create({
    title: 'Yoga & Thien Dinh Co Ban 200H',
    slug: 'yoga-thien-dinh-200h',
    description: 'Khoa hoc yoga va thien dinh danh cho nguoi moi bat dau, giup can bang than tam, giam stress, cai thien suc khoe toan dien.',
    instructor: FAKE_INSTRUCTOR_ID,
    price: 2500000,
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600',
    status: 'published',
    settings: { dripFeed: false, certificateEnabled: true },
  });

  const sec1_1 = await LMSSection.create({
    title: 'Chuong 1: Nhap mon Yoga',
    course: course1._id,
    order: 1,
    status: 'published',
  });

  const act1_1 = await LMSActivity.create({
    title: 'Bai 1: Gioi thieu khoa hoc va loi ich cua Yoga',
    type: 'video',
    section: sec1_1._id,
    order: 1,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  const act1_2 = await LMSActivity.create({
    title: 'Bai 2: Cac tu the co ban (Asana)',
    type: 'video',
    section: sec1_1._id,
    order: 2,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  const act1_3 = await LMSActivity.create({
    title: 'Tai lieu: Huong dan tu the Yoga (PDF)',
    type: 'pdf',
    section: sec1_1._id,
    order: 3,
    status: 'published',
    content: { pdfUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1' },
  });

  sec1_1.activities = [act1_1._id, act1_2._id, act1_3._id];
  await sec1_1.save();

  const sec1_2 = await LMSSection.create({
    title: 'Chuong 2: Ky thuat Thien Dinh',
    course: course1._id,
    order: 2,
    status: 'published',
  });

  const act1_4 = await LMSActivity.create({
    title: 'Bai 3: Thien hoi tho (Pranayama)',
    type: 'video',
    section: sec1_2._id,
    order: 1,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  const act1_5 = await LMSActivity.create({
    title: 'Lop hoc truc tiep: Hoi dap & Thuc hanh cung giang vien',
    type: 'zoom_meeting',
    section: sec1_2._id,
    order: 2,
    status: 'published',
    content: { zoomMeetingId: zoom1._id },
  });

  const act1_6 = await LMSActivity.create({
    title: 'Ghi chu: Tom tat bai hoc tuan 1',
    type: 'text',
    section: sec1_2._id,
    order: 3,
    status: 'published',
    content: {
      textContent: '<h2>Tom tat tuan 1</h2><p>Ban da hoc: 5 tu the Asana co ban, Ky thuat tho Pranayama 4-7-8.</p><p><strong>Bai tap:</strong> Thuc hanh moi sang 15 phut truoc khi an sang.</p>'
    },
  });

  sec1_2.activities = [act1_4._id, act1_5._id, act1_6._id];
  await sec1_2.save();

  course1.sections = [sec1_1._id, sec1_2._id];
  await course1.save();
  console.log('Course 1 created:', course1.title, '| ID:', course1._id.toString());

  // KHOA HOC 2
  const course2 = await LMSCourse.create({
    title: 'Ky nang Huan Luyen Vien Chuyen Nghiep (COACH)',
    slug: 'ky-nang-hlv-chuyen-nghiep',
    description: 'Khoa hoc dao tao ky nang coaching chuyen nghiep: lang nghe chu dong, dat cau hoi, dan dat va phat trien hoc vien.',
    instructor: FAKE_INSTRUCTOR_ID,
    price: 0,
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600',
    status: 'published',
    settings: { dripFeed: false, certificateEnabled: true },
  });

  const sec2_1 = await LMSSection.create({
    title: 'Phan 1: Tu duy Huan luyen vien',
    course: course2._id,
    order: 1,
    status: 'published',
  });

  const act2_1 = await LMSActivity.create({
    title: 'Bai 1: Coach la ai? Khac gi Mentor va Trainer?',
    type: 'video',
    section: sec2_1._id,
    order: 1,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  const act2_2 = await LMSActivity.create({
    title: 'Bai 2: Mo hinh GROW trong Coaching',
    type: 'video',
    section: sec2_1._id,
    order: 2,
    status: 'published',
    content: { videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  });

  sec2_1.activities = [act2_1._id, act2_2._id];
  await sec2_1.save();
  course2.sections = [sec2_1._id];
  await course2.save();
  console.log('Course 2 created:', course2.title, '| ID:', course2._id.toString());

  // Enrollment & Progress
  await LMSEnrollment.create({
    student: FAKE_STUDENT_ID,
    course: course1._id,
    status: 'active',
    paymentAmount: 2500000,
    paymentMethod: 'bank_transfer',
  });

  await LMSProgress.create({
    student: FAKE_STUDENT_ID,
    course: course1._id,
    completedActivities: [act1_1._id, act1_2._id],
    overallProgress: 33,
  });

  await LMSEnrollment.create({
    student: FAKE_STUDENT_ID,
    course: course2._id,
    status: 'active',
    paymentAmount: 0,
    paymentMethod: 'free',
  });

  await LMSProgress.create({
    student: FAKE_STUDENT_ID,
    course: course2._id,
    completedActivities: [],
    overallProgress: 0,
  });

  console.log('Enrollments & Progress created');
  console.log('\n========== SEED THANH CONG ==========');
  console.log('Test API:');
  console.log('  GET  http://localhost:3056/api/lms/courses');
  console.log('  GET  http://localhost:3056/api/lms/courses/' + course1._id);
  console.log('  GET  http://localhost:3056/api/lms/courses/' + course2._id);
  console.log('  POST http://localhost:3056/api/lms/zoom/signature');
  console.log('       Body: { "meetingNumber": "81234567890", "role": 0 }');
  console.log('\nCourse 1 ID:', course1._id.toString());
  console.log('Course 2 ID:', course2._id.toString());
  console.log('Zoom Meeting ID:', zoom1.meetingId);
  console.log('======================================\n');

  await mongoose.disconnect();
  console.log('Disconnected');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
