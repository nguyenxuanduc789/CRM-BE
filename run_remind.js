require('dotenv').config();
const mongoose = require('mongoose');
const { sendTuitionReminders } = require('./src/cron/cron_remind_tuition');

const run = async () => {
    try {
        // Kết nối DB
        await mongoose.connect(process.env.URL_CLOUD_MONGO, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Đã kết nối DB, chuẩn bị gửi email...');

        // Chạy hàm gửi email
        await sendTuitionReminders();

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        // Đóng DB sau khi hoàn tất
        mongoose.connection.close();
        console.log('🔌 Đã ngắt kết nối DB.');
    }
};

run();
