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
const HubPortal = require('./models/HubPortal.model'); // Đường dẫn đến model Hub_Portal
// app.post('/api/pipeline/import', upload.single('file'), async (req, res) => {
const moment = require('moment');
// Cấu hình CORS
const corsOptions = {
  origin: "*", // Cho phép tất cả các nguồn
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Thêm PATCH vào các phương thức HTTP được phép
  allowedHeaders: ["Content-Type", "Authorization"], // Các header được phép
  credentials: true, // Cho phép gửi cookies hoặc token trong yêu cầu
};
const { parse } = require('csv-parse');
const fileUpload = require('express-fileupload');



















// Sử dụng CORS trên toàn bộ các route
app.use(cors(corsOptions));

// Các middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("short"));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());

// Static file
app.use(
  "/uploads",
  express.static(path.join(__dirname, "controllers/uploads"))
);

// LMS: static files for video và document uploads
app.use("/uploads/videos",    express.static(path.join(__dirname, "uploads/videos")));
app.use("/uploads/documents", express.static(path.join(__dirname, "uploads/documents")));

// Routes
const workstreamRoutes = require("./router/workstream/workstreamRoutes");
app.use("/api", workstreamRoutes);

const certificateRoutes = require("./router/certificate.router");
app.use("/api/certificates", certificateRoutes);

const lmsRoutes = require("./router/lms");
app.use("/api/lms", lmsRoutes);

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


app.delete("/api/saleKit/:id", async (req, res) => {
  try {
    const { id } = req.params;
 
    const saleKit = await SaleKit.findByIdAndDelete(id);
    if (!saleKit) {
      return res.status(404).json({ message: "Không tìm thấy Sale Kit" });
    }
 
    return res.status(200).json({ message: "Xoá Sale Kit thành công" });
 
  } catch (err) {
    console.error("❌ deleteSaleKit:", err);
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});









async function getNextIdaca() {
  try {
    // Tìm idaca lớn nhất
    const lastContact = await ContactPortal.findOne()
      .sort({ idaca: -1 })
      .select('idaca');
    
    let nextId = 5020; // Giá trị bắt đầu
    if (lastContact && lastContact.idaca && !isNaN(parseInt(lastContact.idaca))) {
      nextId = Math.max(nextId, parseInt(lastContact.idaca) + 1);
    }
    
    // Kiểm tra lại để đảm bảo idaca không tồn tại
    let existingContact;
    do {
      existingContact = await ContactPortal.findOne({ idaca: nextId.toString() });
      if (existingContact) {
        nextId++;
      }
    } while (existingContact);
    
    return nextId.toString();
  } catch (error) {
    throw new Error(`Lỗi khi tạo idaca: ${error.message}`);
  }
}

// API endpoint để nhập file Excel
// API endpoint để nhập file Excel
// API endpoint để nhập file Excel
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload file Excel' });
    }

    // Đọc file Excel từ đường dẫn trên đĩa
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Mảng lưu trữ kết quả nhập
    const results = [];

    for (const row of data) {
      // Bước 1: Xử lý danh sách sản phẩm để xác định Typesource
      const products = row['Sản Phẩm'] ? row['Sản Phẩm'].split(',').map((p) => p.trim()) : [];
      const productQuantities = {};
      const typesource = new Set();

      // Đếm số lượng từng sản phẩm và kiểm tra danh mục
      for (const product of products) {
        const productName = product.split(' - ')[0].trim().replace(/\s+/g, ' '); // Chuẩn hóa khoảng trắng
        productQuantities[productName] = (productQuantities[productName] || 0) + 1;

        const productData = await Product.findOne({ name: { $regex: `^${productName}$`, $options: 'i' } });
        if (productData) {
          if (productData.category === 'Academy') {
            typesource.add('Academy');
          } else if (productData.category === 'Health Hub') {
            typesource.add('Hub');
          }
        } else {
          results.push({ row, error: `Sản phẩm "${productName}" không tồn tại trong collection Product` });
          continue;
        }
      }

      // Bước 2: Tạo bản ghi ContactPortal mới
      let idaca;
      try {
        idaca = await getNextIdaca();
      } catch (error) {
        results.push({ row, error: error.message });
        continue;
      }

      const contact = new ContactPortal({
        idaca: idaca,
        namecusaca: row['Tên Khách Hàng'] || '',
        emailcusaca: row['Email'] || '',
        phonecusaca: row['Số Điện Thoại'] || '',
        NguoiGT: row['Người Tạo'] || '',
        Typesource: Array.from(typesource),
        dateOfBirth: '',
        gender: '',
        address: '',
      });

      try {
        await contact.save();
      } catch (error) {
        if (error.code === 11000) {
          results.push({ row, error: `Trùng lặp idaca: ${idaca}` });
          continue;
        }
        throw error;
      }

      // Bước 3: Tạo bản ghi HubPortal
      for (const [productName, quantity] of Object.entries(productQuantities)) {
        const product = await Product.findOne({ name: { $regex: `^${productName}$`, $options: 'i' } });
        if (!product) continue;

        const hubPortal = new HubPortal({
          contactId: contact.idaca,
          productId: product._id,
          quantity: quantity,
          paymentDate: row['Ngày Đặt'] ? moment(row['Ngày Đặt'], 'DD/MM/YYYY').format('DD/MM/YYYY') : '',
          createdDate: row['Ngày Đặt'] ? moment(row['Ngày Đặt'], 'DD/MM/YYYY').toDate() : new Date(),
        });
        await hubPortal.save();

        // Bước 4: Tạo bản ghi Pipeline_Portal
        const pipelinePortal = new PipelinePortal({
          contactId: contact.idaca,
          productId: product._id,
          k: `K${row['Mã Đơn Hàng']}`,
          createdDate: row['Ngày Đặt'] ? moment(row['Ngày Đặt'], 'DD/MM/YYYY').toDate() : new Date(),
          updatedDate: row['Ngày Đặt'] ? moment(row['Ngày Đặt'], 'DD/MM/YYYY').toDate() : new Date(),
        });
        await pipelinePortal.save();
      }

      results.push({ row, status: 'Thành công', idaca: contact.idaca });
    }

    // Xóa file tạm
    await fs.promises.unlink(req.file.path).catch((err) => {
      console.error(`Lỗi khi xóa file tạm ${req.file.path}: ${err.message}`);
    });

    return res.status(200).json({ message: 'Nhập dữ liệu thành công', results });
  } catch (error) {
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch((err) => {
        console.error(`Lỗi khi xóa file tạm ${req.file.path}: ${err.message}`);
      });
    }
    console.error('Lỗi khi nhập dữ liệu:', error);
    return res.status(500).json({ error: 'Lỗi server khi nhập dữ liệu', details: error.message });
  }
});




app.post('/api/import-excel', upload.single('file'), async (req, res) => {
  try {
    // Đọc file Excel
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Mảng lưu các STT không hợp lệ và STT thành công
    const notFoundSTTs = [];
    const successSTTs = [];

    for (const row of data) {
      // Ánh xạ cột Excel với schema
      const contactData = {
        idaca: row['STT']?.toString() || 'N/A', // Lưu STT để ghi log
        namecusaca: row['Họ tên KH'] || '',
        Typesource: row['Nguồn KH'] ? [row['Nguồn KH']] : [],
        dateOfBirth: row['Ngày sinh'] || '',
        gender: row['Giới tính'] || '',
        phonecusaca: row['SĐT']?.toString().replace(/[^0-9]/g, '').trim() || '', // Loại bỏ ký tự không phải số
        emailcusaca: row['Email']?.toString().trim() || '', // Lưu email nhưng không dùng
        address: row['Địa chỉ'] || '',
      };

      // Kiểm tra nếu phonecusaca rỗng
      if (!contactData.phonecusaca) {
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: 'Số điện thoại trống',
        });
        continue;
      }

      // Tìm Contact theo phonecusaca
      const contacts = await Contact.find({ phonecusaca: contactData.phonecusaca });

      let existingContact = null;
      if (contacts.length > 1) {
        // Có nhiều bản ghi trùng lặp, ghi log lỗi và bỏ qua
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Tìm thấy ${contacts.length} bản ghi Contact trùng số điện thoại (${contactData.phonecusaca})`,
        });
        continue;
      } else if (contacts.length === 1) {
        // Tìm thấy chính xác một bản ghi
        existingContact = contacts[0];
      } else {
        // Không tìm thấy Contact
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Không tìm thấy Contact với số điện thoại (${contactData.phonecusaca})`,
        });
        continue;
      }

      // Tìm sản phẩm theo productCode
      const productCode = row['Mã dịch vụ'];
      let existingProduct = await Product.findOne({ productCode });

      if (!existingProduct) {
        // Không tìm thấy Product, ghi log STT
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Không tìm thấy Product với productCode: ${productCode}`,
        });
        continue;
      }

      // Tạo bản ghi HubPortal
      const hubPortalData = {
        contactId: existingContact.idaca, // Sử dụng idaca của Contact thay vì _id
        productId: existingProduct._id, // Lấy _id từ Product
        quantity: row['Số lượng'] || 1,
        paymentDate: row['Ngày thanh toán'] || '',
      };

      const newHubPortal = new HubPortal(hubPortalData);
      await newHubPortal.save();

      // Cập nhật Typesource trong Contact
      if (!existingContact.Typesource.includes('Hub')) {
        await Contact.updateOne(
          { _id: existingContact._id },
          { $addToSet: { Typesource: 'Hub' } }
        );
      }

      // Ghi log STT thành công
      successSTTs.push(contactData.idaca);
    }

    // Xóa file tạm
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    // Trả về kết quả
    const response = {
      message: 'Nhập dữ liệu từ Excel hoàn tất.',
      successSTTs,
      notFoundSTTs,
    };
    console.log('Kết quả xử lý:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error);
    res.status(500).json({ message: 'Lỗi khi nhập dữ liệu', error: error.message });
  }
});


app.post('/api/import-excel-by-email', upload.single('file'), async (req, res) => {
  try {
    // Đọc file Excel
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Mảng lưu các STT không hợp lệ và STT thành công
    const notFoundSTTs = [];
    const successSTTs = [];

    for (const row of data) {
      // Ánh xạ cột Excel với schema
      const contactData = {
        idaca: row['STT']?.toString() || 'N/A', // Lưu STT để ghi log
        namecusaca: row['Họ tên KH'] || '',
        Typesource: row['Nguồn KH'] ? [row['Nguồn KH']] : [],
        dateOfBirth: row['Ngày sinh'] || '',
        gender: row['Giới tính'] || '',
        phonecusaca: row['SĐT']?.toString().replace(/[^0-9]/g, '').trim() || '', // Lưu nhưng không dùng
        emailcusaca: row['Email']?.toString().trim() || '', // Dùng để tìm Contact
        address: row['Địa chỉ'] || '',
      };

      // Kiểm tra nếu emailcusaca rỗng
      if (!contactData.emailcusaca) {
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: 'Email trống',
        });
        continue;
      }

      // Kiểm tra định dạng email
      if (!/.+\@.+\..+/.test(contactData.emailcusaca)) {
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Email không hợp lệ: ${contactData.emailcusaca}`,
        });
        continue;
      }

      // Tìm Contact theo emailcusaca
      const contacts = await Contact.find({ emailcusaca: contactData.emailcusaca });

      let existingContact = null;
      if (contacts.length > 1) {
        // Có nhiều bản ghi trùng lặp, ghi log lỗi và bỏ qua
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Tìm thấy ${contacts.length} bản ghi Contact trùng email (${contactData.emailcusaca})`,
        });
        continue;
      } else if (contacts.length === 1) {
        // Tìm thấy chính xác một bản ghi
        existingContact = contacts[0];
      } else {
        // Không tìm thấy Contact
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Không tìm thấy Contact với email (${contactData.emailcusaca})`,
        });
        continue;
      }

      // Tìm sản phẩm theo productCode
      const productCode = row['Mã dịch vụ'];
      let existingProduct = await Product.findOne({ productCode });

      if (!existingProduct) {
        // Không tìm thấy Product, ghi log STT
        notFoundSTTs.push({
          STT: contactData.idaca,
          reason: `Không tìm thấy Product với productCode: ${productCode}`,
        });
        continue;
      }

      // Tạo bản ghi HubPortal
      const hubPortalData = {
        contactId: existingContact.idaca, // Sử dụng idaca của Contact
        productId: existingProduct._id, // Lấy _id từ Product
        quantity: row['Số lượng'] || 1,
        paymentDate: row['Ngày thanh toán'] || '',
      };

      const newHubPortal = new HubPortal(hubPortalData);
      await newHubPortal.save();

      // Cập nhật Typesource trong Contact
      if (!existingContact.Typesource.includes('Hub')) {
        await Contact.updateOne(
          { _id: existingContact._id },
          { $addToSet: { Typesource: 'Hub' } }
        );
      }

      // Ghi log STT thành công
      successSTTs.push(contactData.idaca);
    }

    // Xóa file tạm
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    // Trả về kết quả
    const response = {
      message: 'Nhập dữ liệu từ Excel hoàn tất (dựa trên email).',
      successSTTs,
      notFoundSTTs,
    };
    console.log('Kết quả xử lý:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error);
    res.status(500).json({ message: 'Lỗi khi nhập dữ liệu', error: error.message });
  }
});

app.post('/v1/api/hub/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'Vui lòng upload file.' });
    }

    if (!file.originalname.toLowerCase().endsWith('.xlsx') && !file.originalname.toLowerCase().endsWith('.xls')) {
      await fs.promises.unlink(file.path);
      return res.status(400).json({ message: 'Định dạng file không được hỗ trợ. Vui lòng upload file Excel.' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const skippedRows = [];

    for (const row of data) {
      const stt = row['STT']?.toString().trim();
      const productCode = row['Mã dịch vụ']?.toString().trim();

      if (!stt || !productCode) {
        skippedRows.push({ stt: stt || 'Trống', reason: 'Thiếu STT hoặc Mã dịch vụ' });
        continue;
      }

      const contact = await ContactPortal.findOne({ idaca: stt });
      if (!contact) {
        skippedRows.push({ stt, reason: `Không tìm thấy Contact với STT (idaca) = ${stt}` });
        continue;
      }

      const product = await Product.findOne({ productCode: productCode });
      if (!product) {
        skippedRows.push({ stt, reason: `Không tìm thấy Product với Mã dịch vụ = ${productCode}` });
        continue;
      }

      const newHubEntry = new HubPortal({
        contactId: contact.idaca,
        productId: product._id,
        quantity: row['Số lượng'] || 1,
        paymentDate: row['Ngày thanh toán'] || new Date(),
      });

      try {
        await newHubEntry.save();
      } catch (error) {
        skippedRows.push({ stt, reason: `Lỗi khi lưu vào DB: ${error.message}` });
      }
    }

    await fs.promises.unlink(file.path);

    const totalRows = data.length;
    const skipped = skippedRows.length;
    const imported = totalRows - skipped;

    if (skipped > 0) {
      console.log('Các dòng đã bị bỏ qua:', skippedRows);
    }

    res.status(200).json({
      message: 'Import hoàn tất',
      totalRows,
      importedRows: imported,
      skippedRows: skipped,
      skippedDetails: skipped > 0 ? skippedRows : 'Không có dòng nào bị bỏ qua',
    });

  } catch (error) {
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(() => { });
    }
    res.status(500).json({ message: 'Lỗi server khi import file', error: error.message });
  }
});






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
// ============================================================
// PUBLIC API — Gửi email đăng ký tư vấn lót giày chỉnh hình
// Không cần auth token, dùng cho landing page /test
// ============================================================
const nodemailer = require('nodemailer');

const landingMailTransporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'tech@khitamtherapy.com',
    pass: 'gHyK2h$xU3VL',
  },
  tls: { ciphers: 'SSLv3' },
});

app.post('/api/public/landing-email', async (req, res) => {
  const { name, phone, note } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ message: 'Thiếu họ tên hoặc số điện thoại.' });
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background: linear-gradient(135deg,#0a5c36,#1a8a52); padding: 24px 28px;">
        <h2 style="color:#fff; margin:0; font-size:1.3rem;">🦶 Đăng Ký Tư Vấn Lót Giày Chỉnh Hình</h2>
      </div>
      <div style="padding: 28px;">
        <table style="width:100%; border-collapse: collapse;">
          <tr><td style="padding:10px 0; color:#555; width:140px; font-weight:600;">Họ và tên:</td><td style="padding:10px 0; color:#222; font-weight:700;">${name}</td></tr>
          <tr style="background:#f8fbf9;"><td style="padding:10px 0; color:#555; font-weight:600;">Số điện thoại:</td><td style="padding:10px 0; color:#222; font-weight:700;">${phone}</td></tr>
          <tr><td style="padding:10px 0; color:#555; font-weight:600;">Vấn đề bàn chân:</td><td style="padding:10px 0; color:#222;">${note || 'Không có ghi chú'}</td></tr>
          <tr style="background:#f8fbf9;"><td style="padding:10px 0; color:#555; font-weight:600;">Thời gian:</td><td style="padding:10px 0; color:#222;">${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td></tr>
        </table>
        <div style="margin-top:24px; padding:16px; background:#e8f5ee; border-radius:8px; font-size:0.9rem; color:#0a5c36;">
          ⚡ Khách hàng đăng ký qua landing page lót giày chỉnh hình. Vui lòng liên hệ lại trong vòng <strong>24 giờ</strong>.
        </div>
      </div>
      <div style="background:#f5f5f5; padding:12px 28px; font-size:0.8rem; color:#999; text-align:center;">
        Khí Tâm Therapy — Hotline: 1900 292989
      </div>
    </div>
  `;

  try {
    await landingMailTransporter.sendMail({
      from: '"Khí Tâm Landing Page" <tech@khitamtherapy.com>',
      to:   'tech@khitamtherapy.com',
      cc:   'cloudyluong1205@gmail.com, ducprokb1234@gmail.com, consultant.training@khitamtherapy.com, khitamtherapytech@gmail.com',
      subject: `[Lót Giày Chỉnh Hình] Đăng ký tư vấn — ${name} — ${phone}`,
      html: htmlBody,
    });

    console.log(`✅ Landing email sent: ${name} — ${phone}`);
    return res.status(200).json({ message: 'Gửi email thành công!' });
  } catch (err) {
    console.error('❌ Landing email error:', err.message);
    return res.status(500).json({ message: 'Lỗi gửi email.', error: err.message });
  }
});

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

// API Import HubPortal trực tiếp trong app.js


