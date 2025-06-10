const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Saving file to uploads/ directory...");
    cb(null, "uploads/"); // Thư mục lưu trữ ảnh
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    console.log("Generating filename:", `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  console.log("File type received:", file.mimetype);
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    console.log("File type allowed.");
    cb(null, true);
  } else {
    console.error("File type not allowed.");
    cb(new Error("Chỉ cho phép ảnh định dạng JPEG, PNG hoặc GIF!"));
  }
};

const uploads = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn kích thước ảnh 5MB
  fileFilter,
});

module.exports = uploads;
