require('dotenv').config();
const mongoose = require('mongoose');
const Pipeline = require('./src/models/pineline.model');
const Contact = require('./src/models/contact.model'); // Import để populate

const checkBuyers = async () => {
    try {
        // Kết nối DB
        await mongoose.connect(process.env.URL_CLOUD_MONGO, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Đã kết nối DB');

        const productId = '69b41576d7cca79b3233e217';

        // Tìm các Pipeline có chứa product ID này và đã hoàn tất thu tiền (thành công)
        const pipelines = await Pipeline.find({
            stage: "Hoàn tất thu tiền", // Hoặc status: "Completed" tùy theo logic hệ thống của bạn
            products: productId
        }).populate('contact', 'email name phone');

        console.log(`\n📊 Tìm thấy ${pipelines.length} người mua sản phẩm thành công:\n`);

        pipelines.forEach((p, index) => {
            const email = p.contact ? p.contact.email : 'Không có email';
            const name = p.contact ? p.contact.name : 'Không có tên';
            const purchaseDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : 'Không rõ';
            
            console.log(`${index + 1}. Tên: ${name} | Email: ${email} | Ngày mua: ${purchaseDate}`);
        });

    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        mongoose.connection.close();
    }
};

checkBuyers();
