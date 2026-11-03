require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');

// Import models
const ContactPortal = require('./models/contactprotal.model');
const PipelinePortal = require('./models/pipeline_portal.model');
const HubPortal = require('./models/HubPortal.model');
const Product = require('./models/product.model');

const EXCEL_FILE_PATH = 'C:\\Users\\Admin\\Downloads\\DATA HỌC VIÊN_4.8.2026 (1).xlsx';

const columnToProductCode = {
  'For Face': 'Aca_KT71',
  'Trị liệu GM': 'Aca_KT72',
  'KHLX 20hrs Online': 'Aca_KT76',
  'KHLX 20hrs \n Online': 'Aca_KT76', 
  'KHLX 20hrs E-learning': 'Aca_KT76',
  'KHLX 20hrs\n E-learning': 'Aca_KT76', 
  'KTTL 100hrs': 'Aca_KT81',
  'HLV 200hrs': 'Aca_KT77',
  'HLV 300hrs': 'Aca_KT79',
  'Chỉnh dáng 3H': 'Aca_KT70',
  'Chỉnh dáng 50hrs': 'Aca_KT68',
  'HLV Khí Tâm Yoga Trị Liệu 200h': 'Aca_KT77',
  'HLV Khí Tâm Yoga Trị Liệu 300h': 'Aca_KT79',
  'Coach 100hrs': 'Aca_KT18',
  'Chuyên viên Trị Liệu Tự Nhiên 150h': 'Aca_KT22',
  'HDV Thiền 100h': 'HUB_DVTV40',
  'Master Năng Lượng 50h': 'Aca_KT21',
  'Chuyên gia phòng khám 100h/150h': 'Aca_KT20',
  'KTVD cho trẻ dưới 5T': 'Aca_KT55',
  'Đau lưng\n 14hrs': 'Aca_KT1',
  'Tự chăm sóc sức khoẻ 100h': 'Aca_KT81',
  'Chuyên viên Trị Liệu Bằng Tay 100h': 'Aca_KT78',
  'Yoga For Face ': 'Aca_KT71',
  'Trị liệu Gương mặt 10b': 'Aca_KT72'
};

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Bắt đầu chạy script import. Chế độ Dry-run: ${isDryRun}`);

  try {
    await mongoose.connect(process.env.URL_CLOUD_MONGO);
    console.log('Đã kết nối MongoDB thành công.');

    // Preload Products
    const productCache = {};
    const allProducts = await Product.find({});
    for (const p of allProducts) {
      if (p.productCode) productCache[p.productCode] = p;
    }

    // Preload Contacts để tăng tốc (O(1) lookup)
    console.log('Đang tải danh sách Contact từ DB để cache...');
    const allContacts = await ContactPortal.find({}).lean();
    const contactByPhone = new Map();
    const contactByEmail = new Map();
    let maxIdaca = 5020;
    
    for (const c of allContacts) {
      if (c.phonecusaca) contactByPhone.set(c.phonecusaca, c);
      if (c.emailcusaca) contactByEmail.set(c.emailcusaca, c);
      if (c.idaca && !isNaN(parseInt(c.idaca))) {
        maxIdaca = Math.max(maxIdaca, parseInt(c.idaca));
      }
    }
    console.log(`Đã cache ${allContacts.length} contacts. maxIdaca hiện tại: ${maxIdaca}`);

    // Preload Pipelines & Hubs để check duplicate (tránh spam query)
    console.log('Đang tải danh sách Pipeline & Hub từ DB để cache...');
    const existingPipelines = new Set();
    const existingHubs = new Set();
    
    const allPipelines = await PipelinePortal.find({}).lean();
    for (const p of allPipelines) {
      existingPipelines.add(`${p.contactId}_${p.productId}_${p.k}`);
    }
    
    const allHubs = await HubPortal.find({}).lean();
    for (const h of allHubs) {
      existingHubs.add(`${h.contactId}_${h.productId}`);
    }
    console.log(`Đã cache ${existingPipelines.size} pipelines và ${existingHubs.size} hubs.`);

    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    let allData = [];
    for (const sheetName of workbook.SheetNames) {
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      allData = allData.concat(sheetData);
      console.log(`Đã đọc sheet "${sheetName}". Số dòng: ${sheetData.length}`);
    }
    const data = allData;
    console.log(`Đã gộp tất cả sheets. Tổng số dòng dữ liệu: ${data.length}`);

    let stats = {
      contactsCreated: 0,
      contactsUpdated: 0,
      pipelinesCreated: 0,
      hubsCreated: 0,
      skippedRows: 0,
      unmappedColumns: new Set(),
    };

    const newContactsToSave = [];
    const pipelinesToSave = [];
    const hubsToSave = [];
    const contactsToUpdate = [];

    for (const row of data) {
      const hoVa = row['Họ và']?.toString().trim() || '';
      const ten = row['Tên']?.toString().trim() || '';
      const fullName = `${hoVa} ${ten}`.trim();
      
      let phone = row['SDT']?.toString().replace(/[^0-9]/g, '').trim();
      if (!phone) phone = '';

      let email = row['Email']?.toString().trim() || '';
      if (email.includes(';')) {
        email = email.split(';')[0].trim();
      }

      const address = row['Địa chỉ']?.toString().trim() || '';

      if (!fullName && !phone && !email) {
        stats.skippedRows++;
        continue;
      }

      // 1. Tìm Contact
      let contact = null;
      if (phone && contactByPhone.has(phone)) {
        contact = contactByPhone.get(phone);
      } else if (email && contactByEmail.has(email)) {
        contact = contactByEmail.get(email);
      }

      if (contact) {
        let needsUpdate = false;
        if (!contact.namecusaca && fullName) { contact.namecusaca = fullName; needsUpdate = true; }
        if (!contact.address && address) { contact.address = address; needsUpdate = true; }
        
        if (needsUpdate) {
          contactsToUpdate.push(contact);
          stats.contactsUpdated++;
        }
      } else {
        maxIdaca++;
        const newIdaca = maxIdaca.toString();
        
        contact = {
          idaca: newIdaca,
          namecusaca: fullName,
          phonecusaca: phone,
          emailcusaca: email,
          address: address,
          Typesource: ['ImportHocVien']
        };
        
        newContactsToSave.push(contact);
        
        // Cập nhật vào cache để các dòng sau nếu trùng có thể tìm thấy
        if (phone) contactByPhone.set(phone, contact);
        if (email) contactByEmail.set(email, contact);
        
        stats.contactsCreated++;
      }

      // 2. Xử lý Các khóa học (Pipeline & Hub)
      for (const [colName, cellValue] of Object.entries(row)) {
        if (['STT', 'Họ và', 'Tên', 'SDT', 'Email', 'Địa chỉ', 'KV', 'Ghi chú'].includes(colName)) {
          continue;
        }

        if (cellValue && cellValue.toString().trim()) {
          const kValue = cellValue.toString().trim();
          const productCode = columnToProductCode[colName];

          if (!productCode) {
            stats.unmappedColumns.add(colName);
            continue;
          }

          const product = productCache[productCode];
          if (!product) {
            console.warn(`[WARNING] Cột ${colName} map với ${productCode} nhưng không tồn tại trong DB.`);
            continue;
          }

          const pipelineKey = `${contact.idaca}_${product._id}_${kValue}`;
          if (!existingPipelines.has(pipelineKey)) {
            pipelinesToSave.push({
              contactId: contact.idaca,
              productId: product._id,
              k: kValue
            });
            existingPipelines.add(pipelineKey);
            stats.pipelinesCreated++;
          }

          const hubKey = `${contact.idaca}_${product._id}`;
          if (!existingHubs.has(hubKey)) {
            hubsToSave.push({
              contactId: contact.idaca,
              productId: product._id,
              quantity: 1,
              paymentDate: new Date().toLocaleDateString('en-GB')
            });
            existingHubs.add(hubKey);
            stats.hubsCreated++;
          }
          
          if (product.category === 'Health Hub' && !contact.Typesource.includes('Hub')) {
            contact.Typesource.push('Hub');
          } else if (product.category === 'Academy' && !contact.Typesource.includes('Academy')) {
            contact.Typesource.push('Academy');
          }
        }
      }
    }

    if (!isDryRun) {
      console.log('Đang chèn dữ liệu vào DB...');
      if (newContactsToSave.length > 0) await ContactPortal.insertMany(newContactsToSave);
      if (pipelinesToSave.length > 0) await PipelinePortal.insertMany(pipelinesToSave);
      if (hubsToSave.length > 0) await HubPortal.insertMany(hubsToSave);
      
      for (const c of contactsToUpdate) {
        await ContactPortal.updateOne({ _id: c._id }, { $set: { namecusaca: c.namecusaca, address: c.address, Typesource: c.Typesource } });
      }
    }

    console.log('\n--- KẾT QUẢ IMPORT ---');
    console.log(`- Contact dự kiến tạo mới: ${stats.contactsCreated}`);
    console.log(`- Contact dự kiến cập nhật: ${stats.contactsUpdated}`);
    console.log(`- Pipeline dự kiến tạo mới: ${stats.pipelinesCreated}`);
    console.log(`- Hub dự kiến tạo mới: ${stats.hubsCreated}`);
    console.log(`- Số dòng bị bỏ qua (trống): ${stats.skippedRows}`);
    
    if (stats.unmappedColumns.size > 0) {
      console.log('\n[CẢNH BÁO] Các cột khóa học sau có dữ liệu nhưng chưa được Mapping:');
      stats.unmappedColumns.forEach(col => console.log(`- ${col}`));
    }
    
    if (isDryRun) {
      console.log('\n*** ĐÂY LÀ CHẠY THỬ (DRY RUN). DỮ LIỆU CHƯA ĐƯỢC LƯU VÀO DATABASE ***');
      console.log('Chạy lệnh: "node src/importDataHocVien.js" (không có --dry-run) để import thật.');
    } else {
      console.log('\n*** IMPORT THÀNH CÔNG ***');
    }

  } catch (error) {
    console.error('Lỗi quá trình import:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Đã đóng kết nối MongoDB.');
  }
}

run();
