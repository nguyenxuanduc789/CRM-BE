const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const CertificateAdmin = require('./models/certificateAdmin.model');
const User = require('./models/user.model');
const Role = require('./models/role.model');

const ADMIN_EMAILS = [
  { email: 'ducprokb1234@gmail.com', name: 'Duc Pro KB' },
  { email: 'customercare@khitamtherapy.com', name: 'Customer Care' },
];
const dbURI =
  process.env.URL_CLOUD_MONGO ||
  'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

const seed = async () => {
  for (const admin of ADMIN_EMAILS) {
    await CertificateAdmin.findOneAndUpdate(
      { email: admin.email },
      { email: admin.email, role: 'admin', name: admin.name, active: true },
      { upsert: true, new: true }
    );
    console.log(`✓ CertificateAdmin: ${admin.email}`);
  }

  let adminRole = await Role.findOne({ name: 'Admin' });
  if (!adminRole) {
    adminRole = await Role.create({ name: 'Admin', description: 'Quản trị hệ thống' });
    console.log('✓ Created Role: Admin');
  }

  const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin@2026';
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const primaryAdmin = ADMIN_EMAILS[0].email;

  const existingUser = await User.findOne({ email: primaryAdmin });
  if (existingUser) {
    existingUser.role = adminRole._id;
    existingUser.status = 'active';
    existingUser.password = passwordHash;
    await existingUser.save();
    console.log(`✓ Updated CRM User (Admin): ${primaryAdmin}`);
  } else {
    await User.create({
      email: primaryAdmin,
      firstname: 'Duc',
      lastname: 'Pro',
      password: passwordHash,
      role: adminRole._id,
      status: 'active',
    });
    console.log(`✓ Created CRM User (Admin): ${primaryAdmin}`);
  }

  console.log(`  Mật khẩu CRM (nếu mới/cập nhật): ${seedPassword}`);
};

mongoose
  .connect(dbURI)
  .then(async () => {
    console.log('Connected to MongoDB...');
    await seed();
    await mongoose.connection.close();
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
