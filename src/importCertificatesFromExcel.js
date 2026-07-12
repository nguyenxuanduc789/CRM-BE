/**
 * Import chứng chỉ từ file Excel vào MongoDB
 * Usage: node src/importCertificatesFromExcel.js [đường-dẫn-file.xlsx]
 */
const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config();

const Certificate = require('./models/certificate.model');
const { normalizeVietnamesePhone } = require('./utils/normalizePhone');

const DEFAULT_FILE = path.resolve('C:/Users/Admin/Downloads/test.xlsx');
const dbURI =
  process.env.URL_CLOUD_MONGO ||
  'mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority';

// Từ khóa để tìm cột tương ứng (không phân biệt hoa/thường)
const COL_KEYWORDS = {
  fullName:   ['họ và tên', 'họ tên', 'ho va ten', 'ho ten', 'fullname'],
  email:      ['email', 'mail'],
  phone:      ['sdt', 'sđt', 'số điện thoại', 'phone', 'điện thoại'],
  address:    ['địa chỉ', 'dia chi', 'address'],
  courseName: ['tên khóa học', 'ten khoa hoc', 'khóa học', 'course name'],
  courseCode: ['mã số khóa học', 'mã khóa', 'khóa', 'khoa', 'course code'],
  certNumber: ['số chứng chỉ', 'so chung chi', 'mã bảng', 'ma bang', 'cert'],
};

const cell = (row, key) => {
  const v = row[key];
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

// Tìm key cột thực tế trong row dựa vào danh sách từ khóa
const findColKey = (rowKeys, keywords) => {
  return rowKeys.find(k => {
    const lower = String(k).toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }) || '';
};

const mapRow = (row, index, invalidRows, counters, colMap) => {
  const fullName = cell(row, colMap.fullName);
  const email = cell(row, colMap.email).toLowerCase();
  const phone = normalizeVietnamesePhone(cell(row, colMap.phone));
  const address = cell(row, colMap.address);
  const courseName = cell(row, colMap.courseName);
  const courseCode = cell(row, colMap.courseCode);
  const certNumber = cell(row, colMap.certNumber);
  
  // Tìm cột ngày cấp / course from
  const issueDateKey = Object.keys(row).find(k => {
    const lower = String(k).toLowerCase();
    return lower.includes('ngày cấp') || lower.includes('course from') || lower.includes('ngay cap');
  });
  const issueDate = issueDateKey ? cell(row, issueDateKey) : '';

  const line = index + 2;

  // Bỏ qua dòng trống hoàn toàn
  if (!fullName && !email && !certNumber && !phone && !courseName) {
    return null;
  }

  // --- THUẬT TOÁN TẠO MÃ CHỨNG CHỈ MỚI ---
  // Bóc tách prefix từ SỐ CHỨNG CHỈ
  // VD: "No: 01/YTL–K10/2022" → YTL | "No. 06 CVTL150-K1/Aca2022" → CVTL150 | "No. 01/DTGV75/Aca2022" → DTGV75
  let courseStr = '';
  let prefixMatch = certNumber.match(/No[.:\s]+\d+[\s\/]+([A-Z0-9]+)/i);
  if (prefixMatch) {
    courseStr = prefixMatch[1].toUpperCase();
    if (courseStr === 'CVTL150') courseStr = 'CVTL';
  } else {
    courseStr = courseName || '';
  }

  if (courseStr === 'YTL') {
    // Chỉ với YTL mới ghép thêm số từ TÊN KHÓA HỌC (200H->YTL200, 300H->YTL500)
    let courseNumMatch = courseName.match(/(\d+)/);
    if (courseNumMatch) {
      let courseNum = courseNumMatch[1];
      if (courseNum === '300') {
        courseNum = '500';
      }
      courseStr = `YTL${courseNum}`;
    }
  }

  let paddedCourseCode = courseCode || '';
  if (/^K\d$/i.test(paddedCourseCode)) {
    paddedCourseCode = paddedCourseCode.toUpperCase().replace('K', 'K0');
  }
  
  let certYearMatch = certNumber.match(/(\d{4})/g);
  let certYear = certYearMatch ? certYearMatch[certYearMatch.length - 1] : new Date().getFullYear();
  
  const newCertNumber = `${courseStr}-${paddedCourseCode}/${certYear}`;

  // --- THUẬT TOÁN TẠO MÃ STUDENT ---
  let startYearMatch = issueDate.match(/Course from \d{1,2}\/\d{1,2}\/(\d{4})/i);
  let studentYear = startYearMatch ? startYearMatch[1] : '';
  if (!studentYear) {
    let anyYearMatch = issueDate.match(/(\d{4})/);
    studentYear = anyYearMatch ? anyYearMatch[1] : new Date().getFullYear();
  }

  const paddedCounter = String(counters.student).padStart(4, '0');
  const studentCode = `KTA${paddedCounter}/${studentYear}`;
  counters.student++; // Tăng biến đếm

  return {
    fullName,
    email,
    phone,
    address: address || '—',
    courseName: courseName || '—',
    courseCode: courseCode || '—',
    certNumber,
    issueDate: issueDate || '—',
    newCertNumber,
    studentCode,
  };
};

const run = async () => {
  const filePath = path.resolve(process.argv[2] || DEFAULT_FILE);
  console.log(`Đọc file: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  // Tự động map tên cột Excel → field dựa trên từ khóa
  const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
  const colMap = {};
  for (const [field, keywords] of Object.entries(COL_KEYWORDS)) {
    colMap[field] = findColKey(rowKeys, keywords);
  }
  console.log('Cột đã nhận diện:', colMap);

  const documents = [];
  const invalidRows = [];
  let skipped = 0;
  
  // Tự động tìm mã studentCode cao nhất trong DB để đếm tiếp
  const lastCert = await Certificate.findOne({ studentCode: { $regex: /^KTA/ } }).sort({ studentCode: -1 });
  let startCounter = 1;
  if (lastCert && lastCert.studentCode) {
    const match = lastCert.studentCode.match(/^KTA(\d+)/);
    if (match) {
      startCounter = parseInt(match[1], 10) + 1;
    }
  }
  const counters = { student: startCounter };

  rows.forEach((row, i) => {
    const doc = mapRow(row, i, invalidRows, counters, colMap);
    if (doc) documents.push(doc);
    else if (!row || Object.values(row).every((value) => value === '' || value === null || value === undefined)) {
      skipped += 1;
    }
  });

  if (invalidRows.length > 0) {
    console.warn(`
Dòng không hợp lệ: ${invalidRows.length} dòng sẽ bị bỏ qua.`);
    invalidRows.forEach(({ line, missingFields }) => {
      console.warn(`- Dòng ${line}: thiếu ${missingFields.join(', ')}`);
    });
  }

  console.log(`Hợp lệ: ${documents.length} dòng | Bỏ qua trống: ${skipped}`);

  if (documents.length === 0) {
    console.log('Không có dữ liệu hợp lệ để import.');
    return;
  }

  const samplePhones = documents.slice(0, 3).map((d) => d.phone);
  console.log('Ví dụ SĐT sau chuẩn hóa:', samplePhones.join(', '));

  // Đã bỏ dòng xoá DB để giữ lại dữ liệu cũ và cho phép ghi đè/append

  const inserted = await Certificate.insertMany(documents, { ordered: false });
  console.log(`✓ Đã import ${inserted.length} chứng chỉ vào database`);
};

mongoose
  .connect(dbURI)
  .then(async () => {
    console.log('Connected to MongoDB...');
    await run();
    await mongoose.connection.close();
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
