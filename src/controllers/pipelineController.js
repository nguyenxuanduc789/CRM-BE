const Pipeline = require("../models/pineline.model");
const InstallmentPlan = require("../models/InstallmentPlan.model");
const Contact = require("../models/contact.model");
const User = require("../models/user.model");
const Team = require("../models/team.model");
const Note = require("../models/notes.model");
const KPI = require("../models/kpi.model");
const Product = require("../models/product.model");
const express = require("express");
const multer = require("multer");
const path = require("path");
const { ObjectId } = require("mongoose");
const ActionLog = require("../models/actionlog.model"); // Import ActionLog model
const nodemailer = require("nodemailer");
const AffiliateReport = require("../models/reportaff.model");
const fs = require("fs");
// Tạo thư mục 'uploads' nếu chưa tồn tại
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
    const fileName = `${file.fieldname}${uniqueSuffix}${path.extname(
      file.originalname
    )}`;
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
}).single("image"); // Chỉ chấp nhận 1 ảnh tại một thời điểm
exports.updateInstallmentStatus = async (req, res) => {
  try {
    const { id } = req.params; // Lấy id từ request
    const { status } = req.body; // Trạng thái mới

    // Tìm khoản trả góp theo ID
    const installment = await InstallmentPlan.findById(id);
    console.log(installment);
    if (!installment) {
      return res.status(404).json({ message: "Không tìm thấy khoản trả góp." });
    }

    // Cập nhật trạng thái
    installment.Status = status;
    await installment.save();

    // Nếu trạng thái là "Completed", cập nhật RemainAmount cho kỳ sau
    if (status === "Completed") {
      const nextInstallment = await InstallmentPlan.findOne({
        orderCode: installment.orderCode,
        installmentNumber: `Lần ${
          parseInt(installment.installmentNumber.match(/\d+/)) + 1
        }`,
      });

      if (nextInstallment) {
        nextInstallment.RemainAmount =
          installment.TotalAmount - installment.PaidAmount;
        await nextInstallment.save();
      }
    }

    return res.status(200).json({ message: "Cập nhật trạng thái thành công." });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// Hàm tạo Pipeline và xử lý ảnh
// exports.createPipeline = async (req, res) => {
//   try {
//     // Xử lý upload ảnh (không bắt buộc)
//     upload(req, res, async (err) => {
//       if (err && err.message !== "Unexpected field") {
//         return res
//           .status(400)
//           .json({ message: "Error uploading image", error: err.message });
//       }

//       const {
//         user,
//         stage,
//         contact,
//         amountTotal,
//         expectedCloseDate,
//         notes,
//         paymentPlans,
//         products,
//         createdBy,
//         voucherType,
//         PaymentType,
//         voucherInt,
//         Firstpayment,
//         totalAmount,
//         depositAmount,
//         K,
//       } = req.body;

//       // Kiểm tra và xử lý voucherType, nếu trống thì gán mặc định "Percent"
//       const validVoucherType =
//         voucherType && (voucherType === "Percent" || voucherType === "Amount")
//           ? voucherType
//           : "Percent";

//       // Kiểm tra mảng products
//       if (!products || !Array.isArray(products)) {
//         return res.status(400).json({ message: "Products must be an array." });
//       }

//       // Kiểm tra và xử lý mảng K
//       if (K && Array.isArray(K)) {
//         K.forEach((kItem) => {
//           if (!kItem.product || !kItem.value) {
//             throw new Error("Each K must include product and value.");
//           }
//         });
//       } else if (K) {
//         throw new Error("K must be an array.");
//       }

//       // Xử lý ảnh upload (nếu có), nếu không có ảnh thì để mảng rỗng
//       const images = req.file
//         ? [
//             {
//               url: `/uploads/${req.file.filename}`, // Đường dẫn URL để truy cập ảnh
//               filename: req.file.filename, // Tên file ảnh
//             },
//           ]
//         : [];

//       // Tạo một pipeline mới
//       const pipeline = new Pipeline({
//         user,
//         stage,
//         contact,
//         amountTotal,
//         expectedCloseDate,
//         notes: notes?.trim(),
//         products,
//         createdBy,
//         voucherType: validVoucherType, // Sử dụng giá trị hợp lệ cho voucherType
//         PaymentType,
//         voucherInt,
//         paymentPlans,
//         Firstpayment,
//         totalAmount,
//         depositAmount: depositAmount || 0,
//         K: Array.isArray(K) ? K : [],
//         images, // Lưu thông tin ảnh vào trong Pipeline (nếu có)
//       });

//       // Lưu Pipeline vào cơ sở dữ liệu
//       const savedPipeline = await pipeline.save();
//       // Nếu PaymentType là 'Install' và stage là 'Chia thành nhiều đợt', tạo kế hoạch trả góp
//       if (PaymentType === "Install") {
//         const plans = paymentPlans.map((plan, index) => {
//           let amountRemaining = amountTotal; // Khởi tạo amountRemaining là tổng tiền ban đầu.

//           // Kiểm tra nếu thanh toán trước đó đã thành công, thì mới giảm amountRemaining
//           if (index > 0 && paymentPlans[index - 1].status === "paid") {
//             amountRemaining -= paymentPlans[index - 1].amountDue;
//           }

//           // Tạo kế hoạch trả góp cho lần thanh toán hiện tại
//           return {
//             orderCode: savedPipeline.orderCode,
//             TotalAmount: amountTotal, // Số tiền tổng ban đầu.
//             PaidAmount: plan.amountDue, // Số tiền thanh toán cho lần này.
//             RemainAmount: amountRemaining, // Số tiền còn lại sau các lần thanh toán trước.
//             NoOfPayment: paymentPlans.length, // Tổng số lần thanh toán.
//             Status: "pending", // Trạng thái mặc định là 'pending'.
//             installmentNumber: `Lần ${index + 1}`, // Thêm thông tin số lần thanh toán (Lần 1, Lần 2, Lần 3)
//           };
//         });

//         // Thêm các kế hoạch trả góp vào cơ sở dữ liệu
//         await InstallmentPlan.insertMany(plans);
//       }

//       // Trả về phản hồi
//       res.status(201).json({
//         message: "Pipeline has been created successfully!",
//         pipeline: savedPipeline,
//       });
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error!", error: err.message });
//   }
// };

exports.createPipeline = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err && err.message !== "Unexpected field") {
        return res
          .status(400)
          .json({ message: "Error uploading image", error: err.message });
      }

      const {
        user,
        stage,
        contact,
        amountTotal,
        expectedCloseDate,
        notes,
        paymentPlans,
        products,
        createdBy,
        voucherType,
        PaymentType,
        voucherInt,
        Firstpayment,
        totalAmount,
        depositAmount,
        K,
      } = req.body;

      // Kiểm tra và xử lý voucherType
      const validVoucherType =
        voucherType && (voucherType === "Percent" || voucherType === "Amount")
          ? voucherType
          : "Percent";

      // Kiểm tra mảng products
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ message: "Products must be an array." });
      }

      // Kiểm tra và xử lý mảng K
      if (K && Array.isArray(K)) {
        K.forEach((kItem) => {
          if (!kItem.product || !kItem.value) {
            throw new Error("Each K must include product and value.");
          }
        });
      } else if (K) {
        throw new Error("K must be an array.");
      }

      // Xử lý ảnh upload
      const images = req.file
        ? [
            {
              url: `/uploads/${req.file.filename}`,
              filename: req.file.filename,
            },
          ]
        : [];

      // Lấy thông tin contact để so sánh với AffiliateReports
      const contactData = await Contact.findById(contact).select(
        "email name phone"
      );
      if (!contactData) {
        return res.status(404).json({ message: "Contact not found." });
      }

      // Tìm AffiliateReport khớp với ít nhất một trong ba trường: email, full_name, hoặc phone
      const affiliateReport = await AffiliateReport.findOne({
        $or: [
          { email: contactData.email },
          { full_name: contactData.name }, // name trong Contact tương ứng với full_name
          { phone: contactData.phone },
        ],
      });

      // Tạo pipeline mới
      const pipeline = new Pipeline({
        user,
        stage,
        contact,
        amountTotal,
        expectedCloseDate,
        notes: notes?.trim(),
        products,
        createdBy,
        voucherType: validVoucherType,
        PaymentType,
        voucherInt,
        paymentPlans,
        Firstpayment,
        totalAmount,
        depositAmount: depositAmount || 0,
        K: Array.isArray(K) ? K : [],
        images,
        isAffiliate: !!affiliateReport, // true nếu tìm thấy AffiliateReport, false nếu không
      });

      // Lưu Pipeline
      const savedPipeline = await pipeline.save();

      // Xử lý trả góp nếu PaymentType là 'Install'
      if (PaymentType === "Install") {
        const plans = paymentPlans.map((plan, index) => {
          let amountRemaining = amountTotal;
          if (index > 0 && paymentPlans[index - 1].status === "paid") {
            amountRemaining -= paymentPlans[index - 1].amountDue;
          }

          return {
            orderCode: savedPipeline.orderCode,
            TotalAmount: amountTotal,
            PaidAmount: plan.amountDue,
            RemainAmount: amountRemaining,
            NoOfPayment: paymentPlans.length,
            Status: "pending",
            installmentNumber: `Lần ${index + 1}`,
          };
        });

        await InstallmentPlan.insertMany(plans);
      }

      // Trả về phản hồi
      res.status(201).json({
        message: "Pipeline has been created successfully!",
        pipeline: savedPipeline,
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};
exports.uploadImage = (req, res) => {
  const { pipelineId } = req.params;

  // Xử lý upload ảnh
  upload(req, res, async (err) => {
    if (err && err.message !== "Unexpected field") {
      return res
        .status(400)
        .json({ message: "Error uploading image", error: err.message });
    }

    try {
      const pipeline = await Pipeline.findById(pipelineId);

      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline không tồn tại" });
      }

      // Xử lý ảnh upload (nếu có), nếu không có ảnh thì để mảng rỗng
      const newImage = req.file
        ? {
            url: `/uploads/${req.file.filename}`, // Đường dẫn URL để truy cập ảnh
            filename: req.file.filename, // Tên file ảnh
          }
        : null; // Nếu không có ảnh thì không thay đổi

      // Nếu có ảnh mới, thêm ảnh mới vào mảng images cũ
      if (newImage) {
        pipeline.images.push(newImage);
      }

      // Lưu Pipeline vào cơ sở dữ liệu
      const updatedPipeline = await pipeline.save();

      // Trả về phản hồi
      res.status(200).json({
        message: "Ảnh đã được upload thành công!",
        filename: req.file.filename, // Trả về tên file mới
        pipeline: updatedPipeline,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error!", error: err.message });
    }
  });
};

exports.addNoteToPipeline = async (req, res) => {
  const { orderCode, content, userId } = req.body;

  try {
    // Kiểm tra Pipeline có tồn tại không
    const pipeline = await Pipeline.findOne({ orderCode });
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline không tồn tại." });
    }

    // Tạo ghi chú mới
    const newNote = await Note.create({
      orderCode,
      content,
      createdBy: userId,
    });

    return res
      .status(201)
      .json({ message: "Ghi chú đã được thêm.", data: newNote });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ message: "Lỗi khi thêm ghi chú." });
  }
};
exports.getPipelinesrole = async (req, res) => {
  try {
    const userId = req.query.user_id;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Lấy thông tin người dùng và role
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const userEmail = user.email;
    const userPhone = user.profileDetails?.phone;
    const userFullName = `${user.firstname} ${user.lastname}`;

    // Điều kiện lọc theo ngày
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    let pipelines = [];
    if (role === "Admin" || role === "KTT Sale Manager") {
      pipelines = await Pipeline.find({ ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team
        ? team.members.map((member) => member._id)
        : [];
      const allIds = [...teamMemberIds, userId];

      pipelines = await Pipeline.find({
        createdBy: { $in: allIds },
        ...dateFilter,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT User") {
      pipelines = await Pipeline.find({ createdBy: userId, ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách orderCode từ pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Lấy InstallmentPlan liên quan
    const installmentPlans = await InstallmentPlan.find({
      orderCode: { $in: orderCodes },
    }).select(
      "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
    );

    // Lấy notes liên quan
    const notesFromTable = await Note.find({ orderCode: { $in: orderCodes } })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "firstname lastname");

    // Gắn dữ liệu vào từng pipeline
    const result = pipelines.map((pipeline) => {
      const relatedNotesFromTable = notesFromTable.filter(
        (note) => note.orderCode === pipeline.orderCode
      );
      const relatedPlans = installmentPlans.filter(
        (plan) => plan.orderCode === pipeline.orderCode
      );

      const isEmailMatch = pipeline.contact?.email === userEmail;
      const isPhoneMatch = pipeline.contact?.phone === userPhone;
      const isNameMatch = pipeline.contact?.name === userFullName;
      const isContactMatch = isEmailMatch || isPhoneMatch || isNameMatch;

      return {
        ...pipeline.toObject(),
        installmentPlans: relatedPlans,
        pipelineNotes: pipeline.notes,
        externalNotes: relatedNotesFromTable,
        isContactMatch: isContactMatch,
      };
    });

    return res.status(200).json({ pipelines: result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
exports.getPipelinesroles = async (req, res) => {
  try {
    const userId = req.query.user_id;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Lấy thông tin người dùng và role
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const userEmail = user.email;
    const userPhone = user.profileDetails?.phone;
    const userFullName = `${user.firstname} ${user.lastname}`;

    // Điều kiện lọc theo ngày và trạng thái
    const dateFilter = { status: "Completed" }; // Thêm điều kiện status: Completed
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    let pipelines = [];
    if (role === "Admin" || role === "KTT Sale Manager") {
      pipelines = await Pipeline.find({ ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team
        ? team.members.map((member) => member._id)
        : [];
      const allIds = [...teamMemberIds, userId];

      pipelines = await Pipeline.find({
        createdBy: { $in: allIds },
        ...dateFilter,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else if (role === "KTT User") {
      pipelines = await Pipeline.find({ createdBy: userId, ...dateFilter })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price")
        .sort({ orderCode: -1 });
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách orderCode từ pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Lấy InstallmentPlan liên quan
    const installmentPlans = await InstallmentPlan.find({
      orderCode: { $in: orderCodes },
    }).select(
      "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
    );

    // Lấy notes liên quan
    const notesFromTable = await Note.find({ orderCode: { $in: orderCodes } })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "firstname lastname");

    // Gắn dữ liệu vào từng pipeline
    const result = pipelines.map((pipeline) => {
      const relatedNotesFromTable = notesFromTable.filter(
        (note) => note.orderCode === pipeline.orderCode
      );
      const relatedPlans = installmentPlans.filter(
        (plan) => plan.orderCode === pipeline.orderCode
      );

      const isEmailMatch = pipeline.contact?.email === userEmail;
      const isPhoneMatch = pipeline.contact?.phone === userPhone;
      const isNameMatch = pipeline.contact?.name === userFullName;
      const isContactMatch = isEmailMatch || isPhoneMatch || isNameMatch;

      return {
        ...pipeline.toObject(),
        installmentPlans: relatedPlans,
        pipelineNotes: pipeline.notes,
        externalNotes: relatedNotesFromTable,
        isContactMatch: isContactMatch,
      };
    });

    return res.status(200).json({ pipelines: result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
exports.getPipelinesByCreator = async (req, res) => {
  try {
    const { createdBy } = req.params; // Lấy `createdBy` từ params
    if (!createdBy) {
      return res
        .status(400)
        .json({ message: "createdBy không được để trống." });
    }

    // Truy vấn tất cả các pipeline do người dùng này tạo, không phân biệt trạng thái
    const pipelines = await Pipeline.find({
      createdBy,
    })
      .populate("user", "name email") // Lấy thông tin user liên kết
      .populate("contact", "name phone") // Lấy thông tin contact liên kết
      .populate("products", "name price") // Lấy thông tin sản phẩm liên kết
      .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo, mới nhất trước

    // Lấy tất cả các orderCode trong pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Truy vấn tất cả InstallmentPlan có orderCode tương ứng
    const installmentPlans = await InstallmentPlan.find({
      orderCode: { $in: orderCodes }, // Lấy các InstallmentPlan có orderCode nằm trong danh sách
    }).select(
      "orderCode TotalAmount PaidAmount installmentNumber RemainAmount NoOfPayment Status"
    );

    // Truy vấn tất cả các ghi chú (notes) cho từng orderCode
    const notes = await Note.find({
      orderCode: { $in: orderCodes }, // Lấy các Note có orderCode nằm trong danh sách
    })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "lastname firstname ");

    // Thêm thông tin InstallmentPlan và Note vào từng Pipeline
    const result = pipelines.map((pipeline) => {
      // Lấy các InstallmentPlan cho từng orderCode của pipeline
      const relatedPlans = installmentPlans.filter(
        (plan) => plan.orderCode === pipeline.orderCode
      );

      // Lấy các ghi chú cho từng orderCode của pipeline
      const relatedNotes = notes.filter(
        (note) => note.orderCode === pipeline.orderCode
      );

      return {
        ...pipeline.toObject(),
        installmentPlans: relatedPlans, // Thêm các InstallmentPlan vào pipeline
        note: relatedNotes, // Thêm các ghi chú vào pipeline
      };
    });

    // Trả về kết quả
    return res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi khi lấy pipelines:", error);
    return res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy pipelines.",
      error: error.message,
    });
  }
};

exports.getAllPipelines = async (req, res) => {
  try {
    // Lấy tất cả các pipeline
    const pipelines = await Pipeline.find()
      .populate("createdBy", "lastname firstname email") // Lấy thông tin user liên kết
      .populate("contact", "name phone") // Lấy thông tin contact liên kết
      .populate("products", "name price") // Lấy thông tin sản phẩm liên kết
      .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo, mới nhất trước

    // Trả về kết quả
    return res.status(200).json(pipelines);
  } catch (error) {
    console.error("Lỗi khi lấy tất cả đơn hàng:", error);
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy tất cả đơn hàng." });
  }
};
exports.updatePipelineStatus = async (req, res) => {
  const { id } = req.params;
  const { status, userId } = req.body;

  try {
    const pipeline = await Pipeline.findById(id)
      .populate("createdBy")
      .populate("contact")
      .populate({
        path: "products",
        select: "name", // Chỉ lấy tên sản phẩm
      });

    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline không tồn tại." });
    }

    const oldPipeline = JSON.parse(JSON.stringify(pipeline));
    pipeline.status = status;
    await pipeline.save();

    await ActionLog.create({
      entityId: pipeline._id,
      entity: "Pipeline",
      action: "UPDATE",
      oldValue: oldPipeline,
      newValue: pipeline,
      createdBy: userId,
    });

    let contactEmail = pipeline.contact?.email;
    let customerName = pipeline.contact?.name || "Quý khách hàng";
    let productNames = pipeline.products.map((p) => p.name).join(", "); // Lấy danh sách tên sản phẩm
    let amountTotal = pipeline.amountTotal.toLocaleString("vi-VN") + " VND"; // Số tiền thanh toán

    if (status === "Completed") {
      console.log(
        `Pipeline hoàn thành! Gửi email đến: ${
          contactEmail || "Không có email"
        }`
      );

      if (contactEmail) {
        await sendCompletionEmail(
          contactEmail,
          customerName,
          productNames,
          amountTotal
        );
      }
    }

    res.json({
      message: "Cập nhật trạng thái thành công.",
      pipeline,
    });
  } catch (error) {
    console.error("Error updating pipeline status and KPI:", error);
    res.status(500).json({ error: "Có lỗi xảy ra." });
  }
};

// Hàm gửi email với thông tin cần thiết
async function sendCompletionEmail(
  email,
  customerName,
  productNames,
  amountTotal
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // SMTP server của Outlook
    port: 587, // Cổng 587 cho STARTTLS
    secure: false, // Phải để false nếu dùng port 587
    auth: {
      user: "tech@khitamtherapy.com", // Thay bằng email Outlook của bạn
      pass: "gHyK2h$xU3VL", // Nếu có xác thực 2 bước, cần dùng App Password
    },
  });

  const mailOptions = {
    from: "tech@khitamtherapy.com",
    to: email,
    subject: "Cảm ơn quý khách đã thanh toán",
    text: `Kính gửi quý khách hàng,

Chúng tôi đã nhận được thanh toán của quý khách ${customerName} đăng ký ${productNames}.
Giá trị dịch vụ thanh toán: ${amountTotal}

Chúng tôi trân trọng cảm ơn và tri ân sự tin tưởng của quý khách.
Kính chúc Quý khách mạnh khỏe, hạnh phúc và thành công.

Học viện Khí Tâm Trị Liệu Quốc Tế
(Khi Tam Therapy Academy International)`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email đã gửi đến ${email}`);
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
  }
}

// exports.updatePipelineStatus = async (req, res) => {
//   const { id } = req.params; // ID của pipeline
//   const { status, userId } = req.body; // Trạng thái mới và userId từ frontend

//   try {
//     // Kiểm tra pipeline tồn tại
//     const pipeline = await Pipeline.findById(id)
//       .populate("createdBy")
//       .populate("contact"); // Giả sử pipeline có liên kết với contact

//     if (!pipeline) {
//       return res.status(404).json({ error: "Pipeline không tồn tại." });
//     }

//     // Lưu lại thông tin log hành động
//     const oldPipeline = JSON.parse(JSON.stringify(pipeline)); // Sao chép pipeline trước khi cập nhật
//     pipeline.status = status;
//     await pipeline.save();

//     // Ghi lại hành động vào bảng ActionLog
//     await ActionLog.create({
//       entityId: pipeline._id,
//       entity: "Pipeline",
//       action: "UPDATE",
//       oldValue: oldPipeline,
//       newValue: pipeline,
//       createdBy: userId, // userId lấy từ frontend
//     });

//     // Nếu trạng thái là "Completed", kiểm tra thời gian KPI hiệu lực
//     if (status === "Completed") {
//       const { createdBy, amountTotal, createdAt, contact } = pipeline;

//       // Lấy email của contact (nếu có)
//       const contactEmail = contact?.email || "Không có email";

//       console.log(`Pipeline hoàn thành! Gửi email đến: ${contactEmail}`);

//       // Tìm KPI của người tạo pipeline với điều kiện thời gian
//       const userKPI = await KPI.findOne({
//         user: createdBy._id,
//         startDate: { $lte: createdAt }, // KPI bắt đầu trước hoặc bằng ngày tạo pipeline
//         endDate: { $gte: createdAt }, // KPI kết thúc sau hoặc bằng ngày tạo pipeline
//       });

//       // Nếu không có KPI hợp lệ, chỉ chuyển trạng thái pipeline
//       if (!userKPI) {
//         return res.json({
//           message:
//             "Pipeline đã chuyển trạng thái. Không có KPI trong khoảng thời gian hiệu lực.",
//           pipeline,
//           contactEmail, // Trả về email để kiểm tra
//         });
//       }

//       // Cập nhật KPI của người tạo pipeline
//       userKPI.actual += amountTotal; // Thêm doanh số thực tế đạt được
//       await userKPI.save();

//       // Kiểm tra vai trò của người tạo pipeline (createdBy)
//       const createdByRole = createdBy.role?.name;

//       // Nếu người tạo pipeline là Lead, không cần cập nhật KPI cho Lead khác
//       if (createdByRole === "KTT Sale Team Leader") {
//         return res.json({
//           message:
//             "Cập nhật trạng thái thành công. KPI được cập nhật cho Lead.",
//           pipeline,
//           contactEmail,
//         });
//       }

//       // Nếu người tạo pipeline không phải Lead, tìm Lead của họ và cập nhật KPI
//       const team = await Team.findOne({
//         members: createdBy._id,
//         status: "active",
//       });
//       if (team && team.leadId) {
//         const leadKPI = await KPI.findOne({
//           user: team.leadId,
//           startDate: { $lte: createdAt }, // KPI bắt đầu trước hoặc bằng ngày tạo pipeline
//           endDate: { $gte: createdAt }, // KPI kết thúc sau hoặc bằng ngày tạo pipeline
//         });

//         if (leadKPI) {
//           leadKPI.actual += amountTotal; // Cộng doanh số cho Lead
//           await leadKPI.save();
//         }
//       }
//     }

//     // Trả về phản hồi sau khi chuyển trạng thái và (nếu cần) cập nhật KPI
//     res.json({
//       message: "Cập nhật trạng thái thành công.",
//       pipeline,
//     });
//   } catch (error) {
//     console.error("Error updating pipeline status and KPI:", error);
//     res.status(500).json({ error: "Có lỗi xảy ra." });
//   }
// };

exports.deletePipeline = async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID từ params
    const { userId } = req.body; // Lấy userId từ body

    // Tìm đơn hàng theo ID
    const pipeline = await Pipeline.findById(id);

    if (!pipeline) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng với ID này.",
      });
    }

    // Kiểm tra trạng thái đơn hàng
    if (pipeline.status !== "Pending" && pipeline.status !== "Cancelled") {
      return res.status(400).json({
        message: "Chỉ có thể xóa đơn hàng ở trạng thái Pending hoặc Cancelled.",
      });
    }

    // Ghi lại ActionLog trước khi xóa
    const actionLog = new ActionLog({
      entityId: pipeline._id,
      entity: "Pipeline",
      action: "DELETE",
      oldValue: pipeline,
      createdBy: userId, // Gán userId từ request
    });

    await actionLog.save(); // Lưu vào bảng ActionLogs

    // Xóa hoàn toàn đơn hàng
    await Pipeline.findByIdAndDelete(id); // Xóa đơn hàng khỏi cơ sở dữ liệu

    return res.status(200).json({
      message: "Xóa đơn hàng thành công.",
    });
  } catch (error) {
    console.error("Lỗi khi xóa đơn hàng:", error); // In lỗi ra console
    return res.status(500).json({
      message: "Có lỗi xảy ra khi xóa đơn hàng.",
    });
  }
};
exports.updatePipelineStage = async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const newStage = req.body.stage;
    const createdBy = req.body.createdBy; // Lấy user id từ phía FE

    // Lấy Pipeline hiện tại
    const pipeline = await Pipeline.findById(pipelineId);

    // Nếu không tìm thấy Pipeline
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }

    // Kiểm tra nếu stage có thay đổi
    if (pipeline.stage !== newStage) {
      // Ghi lại ActionLog
      await ActionLog.create({
        entityId: pipelineId,
        entity: "Pipeline",
        action: "UPDATE",
        oldValue: { stage: pipeline.stage },
        newValue: { stage: newStage },
        createdBy: createdBy, // Sử dụng user id từ FE
      });

      // Cập nhật stage mới
      pipeline.stage = newStage;
      await pipeline.save();
    }

    return res
      .status(200)
      .json({ message: "Pipeline updated successfully", pipeline });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getPipelinesroleaca = async (req, res) => {
  try {
    const userId = req.query.user_id; // Lấy user_id từ query parameters
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;
    const serviceFilter = req.query.service; // Lấy loại dịch vụ cần lọc

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Tìm người dùng với user_id và populate role
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;

    // Điều kiện lọc theo datetime
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    let pipelines = [];

    // Lọc theo role và lấy cả đơn "Completed" và "Pending"
    if (
      role === "Admin" ||
      role === "Aca_Specialis" ||
      role === "Cust_service" ||
      role === "KTT Sale Manager"
    ) {
      const serviceMatch = serviceFilter
        ? { category: { $in: serviceFilter.split(",") } }
        : {};

      pipelines = await Pipeline.find({
        ...dateFilter,
        status: { $in: ["Completed", "Pending"] },
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: serviceMatch,
        })
        .sort({ orderCode: -1 });
    } else if (role === "Hub Specialist") {
      pipelines = await Pipeline.find({
        ...dateFilter,
        status: { $in: ["Completed", "Pending"] },
      })
        .populate("contact", "name email")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: { category: "Health Hub" },
        })
        .sort({ orderCode: -1 });

      // Lọc các pipelines chỉ chứa sản phẩm "Health Hub"
      if (req.query.filter_health_hub === "true") {
        pipelines = pipelines.filter((pipeline) =>
          pipeline.products.some((product) => product.category === "Health Hub")
        );
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách orderCode từ pipelines
    const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

    // Truy vấn các notes từ bảng Note liên quan đến orderCode
    const notesFromTable = await Note.find({
      orderCode: { $in: orderCodes },
    })
      .select("orderCode content createdBy createdAt")
      .populate("createdBy", "firstname lastname");

    // Gắn notes từ bảng Note và bảng Pipeline vào từng pipeline
    const result = pipelines.map((pipeline) => {
      const relatedNotesFromTable = notesFromTable.filter(
        (note) => note.orderCode === pipeline.orderCode
      );

      return {
        ...pipeline.toObject(),
        pipelineNotes: pipeline.notes || [], // Notes từ bảng Pipeline
        externalNotes: relatedNotesFromTable, // Notes từ bảng Note
      };
    });

    return res.status(200).json({ pipelines: result });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// exports.getPipelinesroleaca = async (req, res) => {
//   try {
//     const userId = req.query.user_id; // Lấy user_id từ query parameters
//     const startDate = req.query.start_date
//       ? new Date(req.query.start_date)
//       : null;
//     const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

//     if (!userId) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     // Tìm người dùng với user_id và populate role
//     const user = await User.findById(userId).populate("role");
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const role = user.role.name;

//     // Điều kiện lọc theo datetime
//     const dateFilter = {};
//     if (startDate && endDate) {
//       dateFilter.createdAt = { $gte: startDate, $lte: endDate };
//     }

//     let pipelines = [];

//     // Lọc theo role và lấy cả đơn "Completed" và "Pending"
//     if (
//       role === "Admin" ||
//       role === "Aca_Specialis" ||
//       role === "Cust_service" ||
//       role === "KTT Sale Manager"
//     ) {
//       pipelines = await Pipeline.find({
//         ...dateFilter,
//         status: { $in: ["Completed", "Pending"] },
//       })
//         .populate("contact", "name email phone")
//         .populate({
//           path: "createdBy",
//           select: "firstname lastname role",
//           populate: { path: "role", select: "name" },
//         })
//         .populate("products", "name price category")
//         .sort({ orderCode: -1 });
//     } else if (role === "Hub Specialist") {
//       pipelines = await Pipeline.find({
//         ...dateFilter,
//         status: { $in: ["Completed", "Pending"] },
//       })
//         .populate("contact", "name email")
//         .populate({
//           path: "createdBy",
//           select: "firstname lastname role",
//           populate: { path: "role", select: "name" },
//         })
//         .populate({
//           path: "products",
//           select: "name price category",
//           match: { category: "Health Hub" },
//         })
//         .sort({ orderCode: -1 });

//       // Lọc các pipelines chỉ chứa sản phẩm "Health Hub"
//       if (req.query.filter_health_hub === "true") {
//         pipelines = pipelines.filter((pipeline) =>
//           pipeline.products.some((product) => product.category === "Health Hub")
//         );
//       }
//     } else {
//       return res.status(403).json({ message: "Forbidden" });
//     }

//     // Lấy danh sách orderCode từ pipelines
//     const orderCodes = pipelines.map((pipeline) => pipeline.orderCode);

//     // Truy vấn các notes từ bảng Note liên quan đến orderCode
//     const notesFromTable = await Note.find({
//       orderCode: { $in: orderCodes },
//     })
//       .select("orderCode content createdBy createdAt")
//       .populate("createdBy", "firstname lastname");

//     // Gắn notes từ bảng Note và bảng Pipeline vào từng pipeline
//     const result = pipelines.map((pipeline) => {
//       const relatedNotesFromTable = notesFromTable.filter(
//         (note) => note.orderCode === pipeline.orderCode
//       );

//       return {
//         ...pipeline.toObject(),
//         pipelineNotes: pipeline.notes || [], // Notes từ bảng Pipeline
//         externalNotes: relatedNotesFromTable, // Notes từ bảng Note
//       };
//     });

//     return res.status(200).json({ pipelines: result });
//   } catch (error) {
//     console.error(error);
//     return res
//       .status(500)
//       .json({ message: "Server error", error: error.message });
//   }
// };

exports.searchPipelinesByContact = async (req, res) => {
  try {
    const { searchTerm, user_id } = req.body; // Nhận searchTerm và user_id từ request

    // Kiểm tra hợp lệ đầu vào
    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (!searchTerm || typeof searchTerm !== "string") {
      return res
        .status(400)
        .json({ message: "Search term must be a non-empty string" });
    }

    // Lấy thông tin người dùng và vai trò
    const user = await User.findById(user_id).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    const sanitizedSearchTerm = searchTerm.trim();

    // Tìm kiếm liên hệ qua email, tên hoặc số điện thoại
    const contact = await Contact.findOne({
      $or: [
        { email: { $regex: sanitizedSearchTerm, $options: "i" } },
        { name: { $regex: sanitizedSearchTerm, $options: "i" } },
        { phone: { $regex: sanitizedSearchTerm, $options: "i" } },
      ],
    });

    if (!contact) {
      return res
        .status(404)
        .json({ message: "No contact found with this information" });
    }

    // Lấy danh sách pipeline liên quan đến liên hệ
    let pipelines = await Pipeline.find({ contact: contact._id })
      .populate("contact", "name email phone")
      .populate({
        path: "createdBy",
        select: "firstname lastname role",
        populate: { path: "role", select: "name" },
      })
      .populate("products", "name price category")
      .sort({ orderCode: -1 });

    // Phân quyền để lọc pipeline
    if (["Hub Specialist"].includes(role)) {
      pipelines = pipelines.filter((pipeline) =>
        pipeline.products.some((product) => product.category === "Health Hub")
      );
    } else if (
      !["Admin", "Aca_Specialis", "Cust_service", "KTT Sale Manager"].includes(
        role
      )
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lọc các pipeline có trạng thái "Completed"
    const completedPipelines = pipelines.filter(
      (pipeline) =>
        pipeline.status === "Pending" || pipeline.status === "Completed"
    );

    if (completedPipelines.length === 0) {
      return res
        .status(404)
        .json({ message: "No completed pipelines related to this contact" });
    }

    // Trả về kết quả
    return res.status(200).json({
      message: "Search successful!",
      pipelines: completedPipelines,
    });
  } catch (error) {
    console.error("Search error:", error); // Ghi log lỗi
    return res.status(500).json({
      message: "An error occurred during the search",
      error: error.message,
    });
  }
};

// Hàm để escape các ký tự đặc biệt trong searchTerm
const escapeRegExp = (str) => {
  return str.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, "\\$&"); // Escape các ký tự đặc biệt
};

exports.searchPipelinesByProductName = async (req, res) => {
  try {
    const { searchTerm, user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Tìm thông tin người dùng và role
    const user = await User.findById(user_id).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;

    if (!searchTerm || typeof searchTerm !== "string") {
      return res
        .status(400)
        .json({ message: "Search term must be a non-empty string" });
    }

    const sanitizedSearchTerm = escapeRegExp(searchTerm.trim());

    // Tìm kiếm sản phẩm theo tên
    const product = await Product.findOne({
      name: {
        $regex: new RegExp(sanitizedSearchTerm, "i"),
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let pipelines = [];

    if (
      role === "Admin" ||
      role === "Aca_Specialis" ||
      role === "Cust_service" ||
      role === "KTT Sale Manager"
    ) {
      pipelines = await Pipeline.find({
        status: { $in: ["Completed", "Pending"] },
        products: product._id,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate("products", "name price category")
        .sort({ orderCode: -1 });
    } else if (role === "Hub Specialist") {
      pipelines = await Pipeline.find({
        status: { $in: ["Completed", "Pending"] },
        products: product._id,
      })
        .populate("contact", "name email phone")
        .populate({
          path: "createdBy",
          select: "firstname lastname role",
          populate: { path: "role", select: "name" },
        })
        .populate({
          path: "products",
          select: "name price category",
          match: { category: "Health Hub" },
        })
        .sort({ orderCode: -1 });

      if (req.query.filter_health_hub === "true") {
        pipelines = pipelines.filter((pipeline) =>
          pipeline.products.some((product) => product.category === "Health Hub")
        );
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (pipelines.length === 0) {
      return res.status(404).json({
        message: "No pipelines found with this product name",
      });
    }

    const formattedPipelines = pipelines.map((pipeline) => {
      return {
        _id: pipeline._id,
        contact: pipeline.contact,
        amountTotal: pipeline.amountTotal,
        voucherType: pipeline.voucherType,
        PaymentType: pipeline.PaymentType,
        totalAmount: pipeline.totalAmount,
        expectedCloseDate: pipeline.expectedCloseDate,
        notes: pipeline.notes,
        stage: pipeline.stage,
        createdBy: pipeline.createdBy
          ? {
              _id: pipeline.createdBy._id,
              firstname: pipeline.createdBy.firstname,
              lastname: pipeline.createdBy.lastname,
              role: pipeline.createdBy.role
                ? pipeline.createdBy.role.name
                : null,
            }
          : null,
        products: pipeline.products,
        status: pipeline.status,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
        orderCode: pipeline.orderCode,
        K: pipeline.K || [], // Thêm trường K vào đây
        images: pipeline.images || [],
      };
    });

    return res.status(200).json({
      message: "Search successful!",
      pipelines: formattedPipelines,
    });
  } catch (error) {
    console.error("Error occurred while searching pipelines:", error);
    return res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
};
