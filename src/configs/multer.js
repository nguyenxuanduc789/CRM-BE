// config/multer.js
const multer = require('multer');
const path = require('path');

// Cấu hình multer để lưu file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');  // Địa chỉ lưu file
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Đặt tên file bằng timestamp và phần mở rộng của file
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
