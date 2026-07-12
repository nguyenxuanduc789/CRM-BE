/**
 * Seed LMS Users - Tạo 3 tài khoản test
 * Usage: node src/seedLMSUsers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const LMSUser = require('./models/lms_user.model');

const dbURI = process.env.URL_CLOUD_MONGO ||
  'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

async function seed() {
  await mongoose.connect(dbURI);
  console.log('Connected to MongoDB');

  await LMSUser.deleteMany({});
  console.log('Cleared old LMS users');

  const users = [
    {
      fullName: 'Admin Hệ Thống',
      email: 'admin@lms.com',
      password: 'Admin@123',
      role: 'admin',
      phone: '0900000001',
    },
    {
      fullName: 'Nguyễn Văn Đào Tạo',
      email: 'trainer@lms.com',
      password: 'Trainer@123',
      role: 'trainer',
      phone: '0900000002',
    },
    {
      fullName: 'Trần Thị Học Viên',
      email: 'student@lms.com',
      password: 'Student@123',
      role: 'student',
      phone: '0900000003',
    },
  ];

  for (const u of users) {
    const user = new LMSUser(u);
    await user.save();
    console.log(`Created [${u.role}]: ${u.email} / ${u.password}`);
  }

  console.log('\n========== LMS USERS CREATED ==========');
  console.log('Admin   : admin@lms.com   / Admin@123');
  console.log('Trainer : trainer@lms.com / Trainer@123');
  console.log('Student : student@lms.com / Student@123');
  console.log('=======================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
