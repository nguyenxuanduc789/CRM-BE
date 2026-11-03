require('dotenv').config();
const mongoose = require('mongoose');
const ContactPortal = require('./models/contactprotal.model');
const PipelinePortal = require('./models/pipeline_portal.model');
const HubPortal = require('./models/HubPortal.model');

async function checkDb() {
  try {
    await mongoose.connect(process.env.URL_CLOUD_MONGO);
    
    const contactCount = await ContactPortal.countDocuments();
    const pipelineCount = await PipelinePortal.countDocuments();
    const hubCount = await HubPortal.countDocuments();
    
    console.log(`Tổng Contact hiện tại: ${contactCount}`);
    console.log(`Tổng Pipeline hiện tại: ${pipelineCount}`);
    console.log(`Tổng Hub hiện tại: ${hubCount}`);

    // Check specific users from Sheet 2
    const testUsers = [
      'Nguyễn Hà An',
      'Nguyễn Thị Thanh An', 
      'Dương Thị Phương Anh'
    ];

    console.log('\nĐang tìm kiếm học viên từ Sheet 2 (BS 21.8.26)...');
    for (const name of testUsers) {
      const user = await ContactPortal.findOne({ namecusaca: new RegExp(name, 'i') }).lean();
      if (user) {
        console.log(`- Tìm thấy: ${user.namecusaca} (SĐT: ${user.phonecusaca}, Mảng: ${user.Typesource.join(', ')})`);
      } else {
        console.log(`- KHÔNG tìm thấy: ${name}`);
      }
    }
  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkDb();
