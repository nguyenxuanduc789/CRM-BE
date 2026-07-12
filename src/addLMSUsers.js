require('dotenv').config();
const mongoose = require('mongoose');
const LMSUser = require('./models/lms_user.model');

const dbURI = process.env.URL_CLOUD_MONGO ||
  'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

async function addUsers() {
  await mongoose.connect(dbURI);
  console.log('Connected to MongoDB');

  const users = [
    { fullName: 'Duc Pro Admin',  email: 'ducprokb1234@gmail.com', password: '1', role: 'admin'   },
    { fullName: 'Duc Pro Trainer',email: 'ducprokb123@gmail.com',  password: '1', role: 'trainer' },
    { fullName: 'Duc Pro Student',email: 'ducprokb12@gmail.com',   password: '1', role: 'student' },
  ];

  for (const u of users) {
    // Nếu email đã tồn tại thì cập nhật, không thì tạo mới
    const existing = await LMSUser.findOne({ email: u.email });
    if (existing) {
      existing.role = u.role;
      existing.fullName = u.fullName;
      // Cập nhật mật khẩu
      existing.password = u.password;
      existing.isModified = () => true; // bypass
      // Dùng pre-save hook để hash lại
      const tmp = new LMSUser({ ...u });
      await tmp.save();
      await LMSUser.deleteOne({ _id: existing._id });
      console.log(`Updated: ${u.email} [${u.role}]`);
    } else {
      const user = new LMSUser(u);
      await user.save();
      console.log(`Created: ${u.email} [${u.role}]`);
    }
  }

  console.log('\n===== DONE =====');
  console.log('ducprokb1234@gmail.com  / 1  → admin');
  console.log('ducprokb123@gmail.com   / 1  → trainer');
  console.log('ducprokb12@gmail.com    / 1  → student');
  console.log('================\n');

  await mongoose.disconnect();
}

addUsers().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
