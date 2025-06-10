require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const XLSX = require('xlsx');
const Contact = require('./models/contactprotal.model');
const app = express();
const PipelinePortal = require('./models/pipeline_portal.model'); // Đường dẫn đến model Pipeline_Portal
const ContactPortal = require('./models/contactprotal.model');   // Đường dẫn đến model Contact_Portal
const Product = require('./models/product.model');                // Đường dẫn đến model Product
// app.post('/api/pipeline/import', upload.single('file'), async (req, res) => {

// Cấu hình CORS
const corsOptions = {
  origin: "*", // Cho phép tất cả các nguồn
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Thêm PATCH vào các phương thức HTTP được phép
  allowedHeaders: ["Content-Type", "Authorization"], // Các header được phép
  credentials: true, // Cho phép gửi cookies hoặc token trong yêu cầu
};

// Sử dụng CORS trên toàn bộ các route
app.use(cors(corsOptions));

// Các middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("short"));
app.use(helmet());
app.use(compression());

// Static file
app.use(
  "/uploads",
  express.static(path.join(__dirname, "controllers/uploads"))
);

// Routes
const workstreamRoutes = require("./router/workstream/workstreamRoutes");
app.use("/api", workstreamRoutes);

const SaleKit = require("./models/salekit.model");

// Khởi tạo multer để xử lý file upload
const uploadPath = path.resolve(__dirname, "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath); // Sử dụng đường dẫn tuyệt đối
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Routes API
app.get("/api/saleKit", async (req, res) => {
  try {
    const saleKits = await SaleKit.find();
    res.status(200).json(saleKits);
  } catch (err) {
    console.error("Error fetching sale kits:", err); // Log lỗi chi tiết
    res
      .status(500)
      .json({ message: "Lỗi khi lấy dữ liệu", error: err.message });
  }
});

// Tải xuống file PDF
app.get("/api/saleKit/download/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, "uploads", fileName);

  // Kiểm tra xem file có tồn tại không
  fs.exists(filePath, (exists) => {
    if (!exists) {
      return res.status(404).send("File not found");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    fs.createReadStream(filePath).pipe(res);
  });
});

// Đọc nội dung file PDF
app.get("/api/saleKit/read/:fileName", async (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, "uploads", fileName);

  try {
    const fileExists = await fs.promises
      .access(filePath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(404).send("File not found");
    }

    const data = await fs.promises.readFile(filePath);

    try {
      const result = await pdfParse(data);
      res.json({ text: result.text });
    } catch (err) {
      res.status(500).send("Error parsing PDF");
    }
  } catch (err) {
    res.status(500).send("Error reading file");
  }
});

// API tạo SaleKit
app.post("/api/saleKit", upload.single("file"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).send("No file uploaded");
    }

    const saleKit = new SaleKit({
      name,
      description,
      file: file.filename, // lưu tên file vào MongoDB
    });

    await saleKit.save();
    res.status(201).json(saleKit); // Trả về đối tượng SaleKit đã lưu
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// app.post('/api/contacts/import', upload.single('file'), async (req, res) => {
//   try {
//     const file = req.file;

//     if (!file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }

//     // Đọc file Excel
//     const workbook = XLSX.readFile(file.path);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     const data = XLSX.utils.sheet_to_json(worksheet);

//     // Chèn từng dòng dữ liệu vào MongoDB
//     const insertedContacts = [];
//     const errors = [];

//     for (const row of data) {
//       // Ánh xạ các cột Excel với các trường trong schema
//       const contactData = {
//         idaca: row.idaca?.toString().trim(),
//         namecusaca: row.namecusaca?.toString().trim(),
//         NguoiGT: row.NguoiGT?.toString().trim() || '',
//         phonecusaca: row.phonecusaca?.toString().trim(),
//         emailcusaca: row.emailcusaca?.toString().trim(),
//         Typesource: row.Typesource ? row.Typesource.split(',').map(item => item.trim()) : [],
//       };

//       // Kiểm tra dữ liệu bắt buộc
//       if (!contactData.idaca || !contactData.namecusaca || !contactData.phonecusaca || !contactData.emailcusaca) {
//         errors.push({ row, message: 'Missing required fields' });
//         continue;
//       }

//       try {
//         const contact = await Contact.create(contactData);
//         insertedContacts.push(contact);
//       } catch (err) {
//         errors.push({ row, message: err.message });
//       }
//     }

//     // Xóa file tạm sau khi xử lý
//     await fs.promises.unlink(file.path);

//     // Trả về kết quả
//     res.status(201).json({
//       message: 'Import completed',
//       insertedCount: insertedContacts.length,
//       errors: errors.length > 0 ? errors : undefined,
//     });
//   } catch (err) {
//     res.status(500).json({ message: 'Error importing Excel file', error: err.message });
//   }
// });
// Các middleware và logging


// app.post('/api/pipeline/import', upload.single('file'), async (req, res) => {
//   try {
//     const file = req.file;

//     if (!file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }

//     // Đọc file Excel
//     const workbook = XLSX.readFile(file.path);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

//     // Lấy productIds (thực chất là _id) từ dòng thứ 2 (index 1)
//     const productIds = worksheet[1]; // Dòng 2 chứa _id của Product
//     if (!productIds || productIds.length < 2) {
//       await fs.promises.unlink(file.path); // Xóa file tạm
//       return res.status(400).json({ message: 'Invalid Excel format: Missing product ID row' });
//     }

//     // Chuẩn bị kết quả
//     const insertedPipelines = [];
//     const errors = [];

//     // Duyệt qua các dòng từ dòng thứ 3 (index 2)
//     for (let rowIndex = 2; rowIndex < worksheet.length; rowIndex++) {
//       const row = worksheet[rowIndex];
//       const idaca = row[0]?.toString().trim(); // idaca ở cột đầu tiên

//       // Kiểm tra idaca hợp lệ
//       if (!idaca) {
//         errors.push({ row: rowIndex + 1, message: 'Missing idaca' });
//         continue;
//       }

//       // Kiểm tra idaca có tồn tại trong Contact_Portal
//       const contact = await ContactPortal.findOne({ idaca: idaca });
//       if (!contact) {
//         errors.push({ row: rowIndex + 1, message: `idaca ${idaca} not found in Contact_Portal` });
//         continue;
//       }

//       // Duyệt qua các cột (bỏ cột idaca)
//       for (let colIndex = 1; colIndex < row.length; colIndex++) {
//         const kValue = row[colIndex]?.toString().trim() || 'NULL'; // Giá trị k, mặc định 'NULL' nếu rỗng
//         const productId = productIds[colIndex]?.toString().trim(); // Đây là _id của Product

//         // Kiểm tra productId (_id) hợp lệ
//         if (!productId) {
//           errors.push({ row: rowIndex + 1, col: colIndex + 1, message: 'Missing product ID' });
//           continue;
//         }

//         // Tìm Product bằng _id thay vì productCode
//         const product = await Product.findOne({ _id: productId });
//         if (!product) {
//           errors.push({ row: rowIndex + 1, col: colIndex + 1, message: `Product with _id ${productId} not found` });
//           continue;
//         }

//         // Kiểm tra giá trị k (bỏ qua nếu là 'NULL' tùy theo yêu cầu)
//         if (kValue === 'NULL') {
//           continue; // Bỏ qua nếu k là 'NULL' (tùy chỉnh theo yêu cầu)
//         }

//         try {
//           // Tạo bản ghi mới trong Pipeline_Portal
//           const pipelineData = {
//             contactId: idaca,         // Sử dụng idaca từ Contact_Portal
//             productId: product._id,   // Sử dụng _id từ Product
//             k: kValue                 // Giá trị k từ Excel
//           };

//           const pipeline = await PipelinePortal.create(pipelineData);
//           insertedPipelines.push(pipeline);
//         } catch (err) {
//           errors.push({ row: rowIndex + 1, col: colIndex + 1, message: err.message });
//         }
//       }
//     }

//     // Xóa file tạm sau khi xử lý
//     await fs.promises.unlink(file.path);

//     // Trả về kết quả
//     res.status(201).json({
//       message: 'Import completed',
//       insertedCount: insertedPipelines.length,
//       errors: errors.length > 0 ? errors : undefined,
//     });
//   } catch (err) {
//     // Xóa file tạm nếu có lỗi
//     if (req.file) {
//       await fs.promises.unlink(req.file.path).catch(() => {});
//     }
//     res.status(500).json({ message: 'Error importing Excel file', error: err.message });
//   }
// });
app.use((req, res, next) => {
  //console.log(`Request URL: ${req.url}`);
  next();
});

// Init db
require("./dbs/init.mongdb");

// Init routes
app.use("/", require("./router"));
app.use("/videos", express.static(path.join(__dirname, "uploads/videos")));

// Handling errors
app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  const statusCode = error.status || 500;
  const date = new Date().toISOString();
  const paramErrorLogToDev = {
    time: date,
    url: req.url,
    method: req.method,
    query_url: req.query,
    token: req.headers["authorization"],
    body: req.body,
    status: "error",
    code: statusCode,
    error: error.stack,
    message: error.message || "Internal Server Error",
  };
  const paramError = {
    status: "error",
    code: statusCode,
    message: error.message || "Internal Server Error",
  };
  if (statusCode === 500) {
    // pushToLogError(paramErrorLogToDev)
  }
  return res.status(statusCode).json(paramError);
});



module.exports = app;
