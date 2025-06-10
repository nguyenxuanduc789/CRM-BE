const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Workstream = require("../models/workstream.model");

const app = express();
app.use(express.json());

// Đảm bảo thư mục 'uploads/' tồn tại
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("Thư mục 'uploads/' đã được tạo thành công.");
}

// Cấu hình Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log("Đường dẫn lưu file:", uploadDir); // Log đường dẫn
        cb(null, uploadDir); // Sử dụng đường dẫn tuyệt đối
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const fileName = `${file.fieldname}${uniqueSuffix}${path.extname(file.originalname)}`;
        console.log("Tên file được lưu:", fileName);
        cb(null, fileName);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Chấp nhận file hợp lệ
    } else {
        cb(new Error("Chỉ cho phép ảnh định dạng JPEG, PNG hoặc GIF!")); // Từ chối file không hợp lệ
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn kích thước file là 5MB
    fileFilter,
}).single("image");

// API xử lý tải lên
const uploadWorkstream = (req, res) => {
    console.log("Upload bắt đầu...");
    upload(req, res, async (err) => {
        if (err) {
            console.error("Lỗi multer:", err);
            return res.status(400).json({ message: "Lỗi khi upload ảnh!", error: err.message });
        }

        console.log("Request Body:", req.body);
        console.log("Request File:", req.file);

        const { title, description, category, uploadedBy } = req.body;

        try {
            // Nếu không có file, đặt imageUrl là null hoặc ảnh mặc định
            const imageUrl = req.file
                ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
                : null; // Có thể thay bằng ảnh mặc định, ví dụ: 'https://via.placeholder.com/150'

            const newWorkstream = new Workstream({
                title,
                description,
                imageUrl,
                uploadedBy,
                category,
            });

            await newWorkstream.save();

            res.status(201).json({ message: "Tải lên thành công!", workstream: newWorkstream });
        } catch (error) {
            console.error("Lỗi khi lưu dữ liệu:", error);
            res.status(500).json({ message: "Lỗi khi tải lên workstream!", error });
        }
    });
};
const getAllWorkstreams = async (req, res) => {
    try {
      const workstreams = await Workstream.find()
        .populate({
          path: "uploadedBy",
          select: "lastname firstname role", // Lấy lastname, firstname và role
          populate: {
            path: "role", // Populate từ role để lấy name
            select: "name",
          },
        })
        .populate("comments.user", "lastname firstname") // Populate người bình luận
        .populate({
          path: "likes",
          select: "lastname firstname", // Chỉ lấy thông tin người like
        })
        .sort({ createdAt: -1 }); // Sắp xếp theo createdAt (mới nhất lên đầu)
  
      // Thêm số lượt like vào mỗi workstream
      const workstreamsWithLikesCount = workstreams.map(workstream => {
        return {
          ...workstream.toObject(),
          likesCount: workstream.likes.length, // Số lượt like
        };
      });
  
      res.status(200).json({ success: true, data: workstreamsWithLikesCount });
    } catch (error) {
      console.error("Lỗi khi lấy workstreams:", error);
      res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách workstreams." });
    }
  };
  
const likeWorkstream = async (req, res) => {
    try {
      const { workstreamId, userId } = req.body; // Lấy workstreamId và userId từ request
  
      // Tìm workstream bằng workstreamId
      const workstream = await Workstream.findById(workstreamId);
      
      if (!workstream) {
        return res.status(404).json({ success: false, message: "Workstream không tồn tại." });
      }
  
      // Kiểm tra xem user đã like workstream này chưa
      if (workstream.likes.includes(userId)) {
        // Nếu đã like, hủy bỏ like (unlike)
        workstream.likes = workstream.likes.filter(user => user.toString() !== userId.toString());
      } else {
        // Nếu chưa like, thêm user vào danh sách likes
        workstream.likes.push(userId);
      }
  
      await workstream.save(); // Lưu lại workstream đã thay đổi
  
      res.status(200).json({ success: true, message: "Cập nhật trạng thái like thành công.", likes: workstream.likes.length });
    } catch (error) {
      console.error("Lỗi khi xử lý like:", error);
      res.status(500).json({ success: false, message: "Lỗi server khi xử lý like." });
    }
};
const addComment = async (req, res) => {
  try {
    const { postId, userId, text } = req.body;

    if (!postId || !userId || !text) {
      return res.status(400).json({ message: "Thiếu thông tin" });
    }

    const workstream = await Workstream.findById(postId);

    if (!workstream) {
      return res.status(404).json({ message: "Bài viết không tồn tại" });
    }

    // Thêm bình luận mới
    workstream.comments.push({ user: userId, text: text });
    await workstream.save();

    res.status(200).json({
      message: "Bình luận đã được thêm thành công",
      comment: { user: userId, text: text, createdAt: new Date() },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Có lỗi xảy ra trong quá trình thêm bình luận" });
  }
};
module.exports = { uploadWorkstream,addComment,getAllWorkstreams,likeWorkstream };
