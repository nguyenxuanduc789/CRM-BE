const Contact = require("../models/contact.model");
const Pineline = require("../models/pineline.model");
const User = require("../models/user.model");
const Team = require("../models/team.model");
const ActionLog = require("../models/actionlog.model");
const AffiliateReport = require("../models/reportaff.model");
const Product  = require("../models/product.model");
const ContactPortal = require("../models/contactprotal.model");

const multer = require("multer");
const xlsx = require("xlsx");

// ==================== MULTER CONFIG ====================
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file .xlsx hoặc .xls"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadExcelMiddleware = upload.single("file");

// ==================== CONTROLLERS ====================

// Tạo một Contact mới
const createContact = async (req, res) => {
  try {
    const {
      name, email, phone, assignedTo, status, interactionLevel,
      notes, city, country, birthDate, gender, customerSource,
      facebookLink, occupation, ageGroup, maritalStatus,
      numberOfChildren, childrenAgeGroup, familyNotes,
      interests, consultantNotes,
    } = req.body;

    const existingContact = await Contact.findOne({ name, phone });
    if (existingContact) {
      return res.status(400).json({ message: "Liên hệ với tên và số điện thoại này đã tồn tại." });
    }

    const newContact = new Contact({
      name, email, phone, assignedTo, status,
      interactionLevel: interactionLevel || "Tư vấn lần 1",
      notes: notes || "", 
      city, 
      country, 
      birthDate, 
      gender,
      customerSource: customerSource || "",
      facebookLink: facebookLink || "",
      occupation: occupation || "",
      ageGroup: ageGroup || "",
      maritalStatus: maritalStatus || "Độc thân",
      numberOfChildren: numberOfChildren || 0,
      childrenAgeGroup: childrenAgeGroup || "",
      familyNotes: familyNotes || "",
      interests: interests || {},
      consultantNotes: consultantNotes || {},
    });

    await newContact.save();
    return res.status(201).json({ message: "Tạo liên hệ thành công!", contact: newContact });
  } catch (error) {
    console.error("Lỗi khi tạo liên hệ:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo liên hệ." });
  }
};

// ==================== IMPORT EXCEL (ĐÃ SỬA LỖI REGEX) ====================
const importContactsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng upload file Excel." });
    }

    const assignedTo = req.body.assignedTo || req.query.assignedTo;
    if (!assignedTo) {
      return res.status(400).json({ message: "Thiếu thông tin assignedTo (userId)." });
    }

    const workbook = xlsx.read(req.file.buffer, { 
      type: "buffer", 
      cellDates: true 
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", blankrows: false });

    if (rows.length === 0) {
      return res.status(400).json({ message: "File Excel không có dữ liệu." });
    }

    const results = { success: 0, skipped: 0, errors: [] };
    const contactsToInsert = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name  = String(row.name || row["Họ & Tên"] || "").trim();
      const phone = String(row.phone || row["Số điện thoại"] || "").trim();
      const email = String(row.email || row["Email"] || "").trim();

      if (!name || !phone) {
        results.errors.push({ 
          row: rowNum, 
          name, 
          phone, 
          reason: "Thiếu tên hoặc số điện thoại bắt buộc" 
        });
        results.skipped++;
        continue;
      }

      // Kiểm tra trùng lặp - ĐÃ SỬA LỖI REGEX
      const exists = await Contact.findOne({ 
        name: name,      // So sánh chính xác (an toàn với ký tự đặc biệt)
        phone: phone 
      });

      if (exists) {
        results.skipped++;
        results.errors.push({ 
          row: rowNum, 
          name, 
          phone, 
          reason: "Đã tồn tại" 
        });
        continue;
      }

      // Xử lý ngày sinh
      let birthDate = null;
      const rawDate = row.birthDate || row["Ngày sinh"] || "";
      if (rawDate) {
        if (rawDate instanceof Date) {
          birthDate = rawDate;
        } else {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) birthDate = parsed;
        }
      }

      contactsToInsert.push({
        name,
        email: email || undefined,
        phone,
        assignedTo,
        gender:           String(row.gender || row["Giới tính"] || "").trim() || undefined,
        city:             String(row.city || row["Thành phố"] || "").trim(),
        country:          String(row.country || row["Quốc gia"] || "Vietnam").trim(),
        occupation:       String(row.occupation || row["Nghề nghiệp"] || "").trim(),
        interactionLevel: String(row.interactionLevel || row["Cấp độ tương tác"] || "Tư vấn lần 1").trim(),
        notes:            String(row.notes || row["Ghi chú"] || "").trim(),
        customerSource:   String(row.customerSource || row["Nguồn khách"] || "").trim(),
        facebookLink:     String(row.facebookLink || row["Link Facebook"] || "").trim(),
        ageGroup:         String(row.ageGroup || row["Độ tuổi"] || "").trim(),
        maritalStatus:    String(row.maritalStatus || row["Tình trạng hôn nhân"] || "Độc thân").trim(),
        birthDate,
      });
    }

    if (contactsToInsert.length > 0) {
      const inserted = await Contact.insertMany(contactsToInsert, { ordered: false });
      results.success = inserted.length;
    }

    return res.status(200).json({
      message: `Import hoàn tất: ${results.success} thành công, ${results.skipped} bỏ qua.`,
      details: results,
    });

  } catch (error) {
    console.error("Lỗi import Excel:", error);

    if (error.name === "BulkWriteError") {
      return res.status(207).json({
        message: "Import một phần thành công",
        details: {
          success: error.insertedDocs?.length || 0,
          errors: error.writeErrors || []
        }
      });
    }

    return res.status(500).json({ message: "Lỗi máy chủ khi xử lý file Excel." });
  }
};

const createContactWithRelationship = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      assignedTo,
      status,
      relationship,
      interactionLevel,
      notes,
      city,
      country,
      birthDate,
      profileCode, // profileCode được gửi để tìm liên hệ
    } = req.body;

    // Kiểm tra xem profileCode có tồn tại không
    const existingContact = await Contact.findOne({ profileCode });
    if (!existingContact) {
      return res.status(404).json({
        message:
          "Không tìm thấy hồ sơ liên hệ với mã profileCode được cung cấp.",
      });
    }

    // Tạo đối tượng liên hệ mới với relativeProfileCode = profileCode tìm được
    const newContact = new Contact({
      relativeProfileCode: existingContact.profileCode, // Gán profileCode tìm được
      name,
      email,
      phone,
      assignedTo,
      status,
      relationship: relationship || null,
      interactionLevel: interactionLevel || "Tư vấn lần 1",
      notes: notes || "",
      city,
      country,
      birthDate,
      profileCode,
    });

    // Lưu liên hệ mới vào cơ sở dữ liệu
    await newContact.save();

    return res.status(201).json({
      message: "Tạo liên hệ mới thành công!",
      contact: newContact,
    });
  } catch (error) {
    console.error("Lỗi khi tạo liên hệ:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo liên hệ." });
  }
};
const updateContact = async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID của liên hệ từ URL
    const updateData = req.body; // Dữ liệu mới từ client
    const userId = updateData.userId; // Lấy ID người dùng từ dữ liệu gửi lên (gửi từ frontend)

    // Lấy thông tin liên hệ hiện tại từ cơ sở dữ liệu
    const currentContact = await Contact.findById(id);
    if (!currentContact) {
      return res.status(404).json({ message: "Không tìm thấy liên hệ." });
    }

    // Kiểm tra trùng lặp tên hoặc số điện thoại (loại trừ liên hệ hiện tại)
    const duplicateContact = await Contact.findOne({
      $or: [{ phone: updateData.phone }, { name: updateData.name }],
      _id: { $ne: id }, // Loại trừ liên hệ đang chỉnh sửa
    });

    if (duplicateContact) {
      if (duplicateContact.profileCode !== currentContact.relativeProfileCode) {
        return res.status(400).json({
          message:
            "Tên hoặc số điện thoại đã tồn tại trên hệ thống. Nếu là người trong gia đình, hãy kiểm tra mã hồ sơ liên quan.",
        });
      }
    }

    // Lưu lại giá trị cũ của liên hệ trước khi cập nhật
    const oldContact = { ...currentContact.toObject() };

    // Cập nhật thông tin liên hệ
    const updatedContact = await Contact.findByIdAndUpdate(id, updateData, {
      new: true, // Trả về đối tượng đã được cập nhật
      runValidators: true, // Áp dụng validation
    });

    // Lưu hành động vào ActionLog
    const actionLog = new ActionLog({
      entityId: id,
      entity: "Contact",
      action: "UPDATE",
      oldValue: oldContact, // Giá trị cũ
      newValue: updatedContact, // Giá trị mới
      createdBy: userId, // Người thực hiện hành động
    });

    await actionLog.save(); // Lưu hành động vào ActionLog

    // Trả về thông tin liên hệ sau khi cập nhật
    return res.status(200).json({
      message: "Cập nhật liên hệ thành công!",
      contact: updatedContact,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật liên hệ:", error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ khi cập nhật liên hệ." });
  }
};

// Lấy tất cả các Contact
const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().populate("assignedTo pipeline");
    return res.status(200).json(contacts);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error while fetching contacts." });
  }
};
// Người quản lý
const getContactsByAssignedTo = async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ params

    // Tìm tất cả các contact có assignedTo là userId và sắp xếp theo profileCode từ lớn đến nhỏ
    const contacts = await Contact.find({ assignedTo: userId })
      .populate("assignedTo") // Liên kết với User
      .populate("pipeline") // Liên kết với tất cả các Pipeline
      .sort({ profileCode: -1 }); // Sắp xếp theo profileCode từ lớn đến nhỏ

    if (!contacts || contacts.length === 0) {
      return res
        .status(404)
        .json({ message: "No contacts found for this user." });
    }

    return res.status(200).json(contacts); // Trả về danh sách các contact
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error while fetching contacts." });
  }
};

// tìm kiếm dựa vào người quản lý
const findContactsForUser = async (req, res) => {
  try {
    const { query } = req.query; // Lấy từ khóa tìm kiếm từ query string

    let searchConditions = {}; // Mở rộng tìm kiếm cho tất cả khách hàng (không lọc theo userId)

    if (query) {
      // Kiểm tra nếu là số thì tìm theo profileCode
      const isNumber = !isNaN(query) && Number(query).toString() === query;

      if (isNumber) {
        searchConditions.profileCode = Number(query);
      } else {
        // Nếu không phải số, tìm kiếm trong Tên, Email hoặc Số điện thoại
        searchConditions.$or = [
          { name: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
          { phone: { $regex: query, $options: "i" } },
        ];
      }
    }

    const contacts = await Contact.find(searchConditions)
      .populate("assignedTo pipeline")
      .sort({ profileCode: -1 }); // Sắp xếp hồ sơ mới nhất lên đầu

    if (!contacts || contacts.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy liên hệ nào với thông tin đã cung cấp.",
      });
    }

    return res.status(200).json(contacts);
  } catch (error) {
    console.error("Lỗi khi tìm kiếm liên hệ:", error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ khi tìm kiếm liên hệ." });
  }
};

// Xóa Contact theo ID
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.contactId);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found." });
    }

    return res.status(200).json({ message: "Contact deleted successfully!" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error while deleting contact." });
  }
};

const getContactsrole = async (req, res) => {
  try {
    const userId = req.query.user_id; // Lấy user_id từ query parameters
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Tìm người dùng với user_id
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;

    // Tính thời gian mặc định từ đầu tháng đến hiện tại nếu không có start_date và end_date
    const defaultStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    const defaultEnd = new Date();

    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else {
      filter.createdAt = { $gte: defaultStart, $lte: defaultEnd };
    }

    // Hàm kiểm tra trùng khớp với AffiliateReport
    const findAffiliateMatch = async (contact) => {
      try {
        // Chỉ kiểm tra các trường nếu chúng không phải là null hoặc rỗng
        const conditions = [];
        if (contact.name) conditions.push({ full_name: contact.name });
        if (contact.email) conditions.push({ email: contact.email });
        if (contact.phone) conditions.push({ phone: contact.phone });

        // Nếu không có trường nào hợp lệ, trả về null
        if (conditions.length === 0) {
          return { affiliate_id: null, affiliate_name: null };
        }

        // Tìm bản ghi AffiliateReport khớp với name, email, hoặc phone
        const affiliate = await AffiliateReport.findOne({
          $or: conditions,
        })
          .sort({ datetime: -1 }) // Lấy bản ghi mới nhất
          .select("affiliate_id affiliate_name");

        return affiliate
          ? {
              affiliate_id: affiliate.affiliate_id,
              affiliate_name: affiliate.affiliate_name,
            }
          : { affiliate_id: null, affiliate_name: null };
      } catch (error) {
        console.error(
          `Lỗi khi kiểm tra AffiliateReport cho liên hệ ${contact._id}:`,
          error
        );
        return { affiliate_id: null, affiliate_name: null }; // Trả về null nếu có lỗi
      }
    };

    let contacts = [];

    // 1. Admin có quyền xem tất cả các liên hệ
    if (role === "Admin") {
      contacts = await Contact.find({ ...filter })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // 2. KTT Sale Manager có quyền xem tất cả các liên hệ
    else if (role === "KTT Sale Manager") {
      contacts = await Contact.find({ ...filter })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // 3. KTT Sale Team Leader chỉ xem các liên hệ của nhóm mình quản lý
    else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team
        ? team.members.map((member) => member._id)
        : [];
      const allIds = [...teamMemberIds, userId];

      contacts = await Contact.find({
        assignedTo: { $in: allIds },
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // 4. KTT User chỉ xem các liên hệ được phân công
    else if (role === "KTT User") {
      contacts = await Contact.find({
        assignedTo: userId,
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
     // 4. KTT Partner chỉ xem các liên hệ được phân công
    else if (role === "KTT Partner") {
      contacts = await Contact.find({
        assignedTo: userId,
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // Trả về lỗi nếu vai trò không hợp lệ
    else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Thêm affiliate_id và affiliate_name vào mỗi liên hệ
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => {
        const affiliateData = await findAffiliateMatch(contact);
        return {
          ...contact.toObject(), // Chuyển đổi document Mongoose thành object
          affiliate_id: affiliateData.affiliate_id,
          affiliate_name: affiliateData.affiliate_name,
        };
      })
    );

    return res.status(200).json({ contacts: enrichedContacts });
  } catch (error) {
    console.error("Lỗi trong API getContactsrole:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
const suggestContacts = async (req, res) => {
  try {
    const userId = req.query.user_id; // Lấy user_id từ query parameters
    const searchQuery = req.query.search; // Lấy email hoặc số điện thoại từ query

    if (!userId) {
      return res.status(400).json({ message: "ID người dùng là bắt buộc" });
    }

    if (!searchQuery) {
      return res.status(400).json({ message: "Cần cung cấp email hoặc số điện thoại để tìm kiếm" });
    }

    // Tìm người dùng với user_id và lấy vai trò
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const role = user.role.name;

    // Hàm kiểm tra trùng khớp với AffiliateReport (giữ nguyên từ getContactsrole)
    const findAffiliateMatch = async (contact) => {
      try {
        const conditions = [];
        if (contact.name) conditions.push({ full_name: contact.name });
        if (contact.email) conditions.push({ email: contact.email });
        if (contact.phone) conditions.push({ phone: contact.phone });

        if (conditions.length === 0) {
          return { affiliate_id: null, affiliate_name: null };
        }

        const affiliate = await AffiliateReport.findOne({ $or: conditions })
          .sort({ datetime: -1 })
          .select("affiliate_id affiliate_name");

        return affiliate
          ? {
              affiliate_id: affiliate.affiliate_id,
              affiliate_name: affiliate.affiliate_name,
            }
          : { affiliate_id: null, affiliate_name: null };
      } catch (error) {
        console.error(`Lỗi khi kiểm tra AffiliateReport cho liên hệ ${contact._id}:`, error);
        return { affiliate_id: null, affiliate_name: null };
      }
    };

    // Điều kiện tìm kiếm dựa trên email hoặc số điện thoại
    const searchFilter = {
      $or: [
        { email: { $regex: searchQuery, $options: "i" } }, // Tìm kiếm email không phân biệt hoa thường
        { phone: { $regex: searchQuery, $options: "i" } }, // Tìm kiếm số điện thoại
      ],
    };

    let contacts = [];

    // 1. Admin: Xem tất cả liên hệ khớp với tìm kiếm
    if (role === "Admin") {
      contacts = await Contact.find({ ...searchFilter })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // 2. KTT Sale Manager: Xem tất cả liên hệ khớp với tìm kiếm
    else if (role === "KTT Sale Manager") {
      contacts = await Contact.find({ ...searchFilter })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // 3. KTT Sale Team Leader: Chỉ xem liên hệ của nhóm mình quản lý
    else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team ? team.members.map((member) => member._id) : [];
      const allIds = [...teamMemberIds, userId];

      contacts = await Contact.find({
        assignedTo: { $in: allIds },
        ...searchFilter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // 4. KTT User: Chỉ xem liên hệ được phân công cho mình
    else if (role === "KTT User") {
      contacts = await Contact.find({
        assignedTo: userId,
        ...searchFilter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
     // 4. KTT Partner: Chỉ xem liên hệ được phân công cho mình
    else if (role === "KTT Partner") {
      contacts = await Contact.find({
        assignedTo: userId,
        ...searchFilter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    }
    // Vai trò không hợp lệ
    else {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }

    // Thêm affiliate_id và affiliate_name vào mỗi liên hệ, giữ nguyên toàn bộ dữ liệu của Contact
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => {
        const affiliateData = await findAffiliateMatch(contact);
        return {
          ...contact.toObject(), // Chuyển đổi document Mongoose thành object để trả về toàn bộ dữ liệu
          affiliate_id: affiliateData.affiliate_id,
          affiliate_name: affiliateData.affiliate_name,
        };
      })
    );

    return res.status(200).json({ contacts: enrichedContacts });
  } catch (error) {
    console.error("Lỗi trong API suggestContacts:", error);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};




const getContactstudents = async (req, res) => {
  try {
    const userId = req.query.user_id; // Lấy user_id từ query parameters
    const startDate = req.query.start_date
      ? new Date(req.query.start_date)
      : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Tìm người dùng với user_id
    const user = await User.findById(userId).populate("role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;

    // Tính thời gian mặc định từ đầu tháng đến hiện tại nếu không có `start_date` và `end_date`
    const defaultStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ); // Ngày đầu tháng
    const defaultEnd = new Date(); // Ngày hiện tại

    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else {
      filter.createdAt = { $gte: defaultStart, $lte: defaultEnd }; // Sử dụng thời gian mặc định nếu không có filter
    }

    // Tìm các nhóm mà người dùng thuộc về
    const userTeams = await Team.find({
      members: userId,
      status: "active",
    }).populate("leadId");

    let contactsQuery = [];
    // Logic phân quyền dựa trên vai trò
    if (role === "Admin") {
      contactsQuery = await Contact.find({ ...filter })
        .select(
          "profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel"
        ) // Chỉ lấy các trường cần thiết
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    } else if (role === "KTT Sale Manager") {
      contactsQuery = await Contact.find({ ...filter })
        .select(
          "profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel"
        ) // Chỉ lấy các trường cần thiết
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    } else if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team ? team.members : [];
      const allIds = [...teamMemberIds, userId];

      contactsQuery = await Contact.find({
        assignedTo: { $in: allIds },
        ...filter,
      })
        .select(
          "profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel"
        ) // Chỉ lấy các trường cần thiết
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: 1 });
    } else if (role === "KTT User") {
      contactsQuery = await Contact.find({
        assignedTo: userId,
        ...filter,
      })
        .select(
          "profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel"
        ) // Chỉ lấy các trường cần thiết
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });
    } else if (role === "KTT Partner") {
      contactsQuery = await Contact.find({
        assignedTo: userId,
        ...filter,
      })
        .select(
          "profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel"
        ) // Chỉ lấy các trường cần thiết
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });

    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Lấy danh sách pipelines liên quan đến mỗi contact
    const contactsWithPipelines = await Promise.all(
      contactsQuery.map(async (contact) => {
        const pipelines = await Pineline.find({ contact: contact._id })
          .populate("products")
          .populate("createdBy", "firstname lastname");
        return {
          ...contact.toObject(),
          pipelines,
        };
      })
    );

    return res.status(200).json({ contacts: contactsWithPipelines });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};


const searchByProduct = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : null;
    const startDate = req.query.start_date ? new Date(req.query.start_date) : new Date("2021-12-12T00:00:00.000Z");
    const endDate   = req.query.end_date   ? new Date(req.query.end_date)   : new Date();

    if (!search) {
      return res.status(400).json({ message: "Vui lòng nhập tên sản phẩm để tìm kiếm." });
    }

    // 1. Tìm products khớp tên
    const matchedProducts = await Product.find({
      name: { $regex: search, $options: "i" },
    }).select("_id name price productCode");

    if (matchedProducts.length === 0) {
      return res.status(200).json({ contacts: [], total: 0, products: [] });
    }

    const productIds = matchedProducts.map((p) => p._id);

    // 2. Tìm pipelines chứa product đó trong khoảng ngày
    const matchedPipelines = await Pineline.find({
      products: { $in: productIds },
      createdAt: { $gte: startDate, $lte: endDate },
    }).select("contact");

    if (matchedPipelines.length === 0) {
      return res.status(200).json({ contacts: [], total: 0, products: matchedProducts });
    }

    // 3. Lấy danh sách contactId không trùng
    const contactIds = [
      ...new Set(
        matchedPipelines
          .map((pl) => pl.contact?.toString())
          .filter(Boolean)
      ),
    ];

    // 4. Lấy thông tin Contact
    const contactsQuery = await Contact.find({
      _id: { $in: contactIds },
    })
      .select("profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel")
      .populate("assignedTo", "firstname lastname role")
      .sort({ profileCode: -1 });

    // 5. Gắn pipelines vào từng contact
    const contactsWithPipelines = await Promise.all(
      contactsQuery.map(async (contact) => {
        const pipelines = await Pineline.find({ contact: contact._id })
          .populate("products")
          .populate("createdBy", "firstname lastname");
        return { ...contact.toObject(), pipelines };
      })
    );

    return res.status(200).json({
      contacts: contactsWithPipelines,
      total:    contactsWithPipelines.length,
      products: matchedProducts, // danh sách sản phẩm tìm được
    });

  } catch (error) {
    console.error("Lỗi searchByProduct:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getContactstudentss = async (req, res) => {
  try {
    const startDate = req.query.start_date ? new Date(req.query.start_date) : null;
    const endDate   = req.query.end_date   ? new Date(req.query.end_date)   : null;
    const search    = req.query.search     ? req.query.search.trim()        : null;

    // ── Điều kiện ngày ────────────────────────────────────────────────────────
    const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const defaultEnd   = new Date();

    const dateCondition = {
      createdAt: {
        $gte: startDate || defaultStart,
        $lte: endDate   || defaultEnd,
      },
    };

    // ── Điều kiện tìm kiếm ────────────────────────────────────────────────────
    const searchCondition = (() => {
      if (!search) return null;

      const orClauses = [
        { name:  { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];

      const asNumber = Number(search);
      if (!isNaN(asNumber) && search !== "") {
        orClauses.push({ profileCode: asNumber });
      }

      return { $or: orClauses };
    })();

    // ── Gộp điều kiện ─────────────────────────────────────────────────────────
    const buildQuery = () => {
      const clauses = [dateCondition];
      if (searchCondition) clauses.push(searchCondition);
      return clauses.length === 1 ? clauses[0] : { $and: clauses };
    };

    const selectFields =
      "profileCode name email phone status assignedTo city country birthDate createdAt interactionLevel";

    // ── Mặc định Admin: lấy tất cả contacts ──────────────────────────────────
    const contactsQuery = await Contact.find(buildQuery())
      .select(selectFields)
      .populate("assignedTo", "firstname lastname role")
      .sort({ profileCode: -1 });

    // ── Lấy pipelines ─────────────────────────────────────────────────────────
    const contactsWithPipelines = await Promise.all(
      contactsQuery.map(async (contact) => {
        const pipelines = await Pineline.find({ contact: contact._id })
          .populate("products")
          .populate("createdBy", "firstname lastname");
        return { ...contact.toObject(), pipelines };
      })
    );

    return res.status(200).json({
      contacts: contactsWithPipelines,
      total:    contactsWithPipelines.length,
    });

  } catch (error) {
    console.error("Lỗi getContactstudentss:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


const getActiveUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "active" })
      .select("email lastname firstname employeeCode role status")
      .populate("role", "name")
      .sort({ createdAt: -1 });
 
    return res.status(200).json({
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("Lỗi getActiveUsers:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
 
// PATCH /api/v1/contact/assign/:contactId
const assignContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ message: "assignedTo (userId) là bắt buộc" });
    }

    // Kiểm tra user tồn tại và đang active
    const user = await User.findOne({ _id: assignedTo, status: "active" });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user hoặc user không active" });
    }

    // Kiểm tra contact tồn tại
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Không tìm thấy contact" });
    }

    // Cập nhật assignedTo
    contact.assignedTo = assignedTo;
    await contact.save();

    // Trả về contact đã populate assignedTo
    const updated = await Contact.findById(contactId)
      .select("profileCode name email phone assignedTo")
      .populate("assignedTo", "firstname lastname email role");

    return res.status(200).json({
      message: "Assign thành công",
      contact: updated,
    });

  } catch (error) {
    console.error("Lỗi assignContact:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
 
// ==================== EXPORT TO EXCEL ====================
const exportContactsToExcel = async (req, res) => {
  try {
    // 1. Fetch Contact
    const contacts = await Contact.find()
      .populate("assignedTo", "firstname lastname")
      .sort({ profileCode: -1 });

    const contactData = contacts.map((c) => ({
      "Mã hồ sơ": c.profileCode || "",
      "Họ & Tên": c.name || "",
      "Email": c.email || "",
      "Số điện thoại": c.phone || "",
      "Trạng thái": c.status || "",
      "Người phụ trách": c.assignedTo ? `${c.assignedTo.firstname || ""} ${c.assignedTo.lastname || ""}`.trim() : "",
      "Cấp độ tương tác": c.interactionLevel || "",
      "Ghi chú": c.notes || "",
      "Thành phố": c.city || "",
      "Quốc gia": c.country || "",
      "Ngày sinh": c.birthDate ? new Date(c.birthDate).toLocaleDateString("vi-VN") : "",
      "Giới tính": c.gender || "",
      "Nguồn khách": c.customerSource || "",
      "Link Facebook": c.facebookLink || "",
      "Nghề nghiệp": c.occupation || "",
      "Độ tuổi": c.ageGroup || "",
      "Tình trạng hôn nhân": c.maritalStatus || "",
      "Ngày tạo": c.createdAt ? new Date(c.createdAt).toLocaleDateString("vi-VN") : ""
    }));

    // 2. Fetch ContactPortal
    const contactPortals = await ContactPortal.find().sort({ createdAt: -1 });
    
    const portalData = contactPortals.map((p) => ({
      "ID ACA": p.idaca || "",
      "Tên Khách Hàng": p.namecusaca || "",
      "Email": p.emailcusaca || "",
      "Số điện thoại": p.phonecusaca || "",
      "Người Giới Thiệu": p.NguoiGT || "",
      "Loại Nguồn (TypeSource)": Array.isArray(p.Typesource) ? p.Typesource.join(", ") : (p.Typesource || ""),
      "Ngày sinh": p.dateOfBirth || "",
      "Giới tính": p.gender || "",
      "Địa chỉ": p.address || "",
      "Ngày tạo": p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : ""
    }));

    // 3. Create Workbook & Sheets
    const workbook = xlsx.utils.book_new();

    const contactSheet = xlsx.utils.json_to_sheet(contactData);
    xlsx.utils.book_append_sheet(workbook, contactSheet, "Contacts");

    const portalSheet = xlsx.utils.json_to_sheet(portalData);
    xlsx.utils.book_append_sheet(workbook, portalSheet, "Contact Portals");

    const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.xlsx");

    return res.status(200).send(excelBuffer);
  } catch (error) {
    console.error("Lỗi khi xuất file Excel:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi xuất file Excel." });
  }
};

// ==================== EXPORT ====================
module.exports = {
  uploadExcelMiddleware,        // ← Quan trọng
  createContact,
  importContactsFromExcel,      // ← Hàm import
  createContactWithRelationship,
  updateContact,
  getContacts,
  getContactsByAssignedTo,
  findContactsForUser,
  deleteContact,
  getContactsrole,
  suggestContacts,
  getContactstudents,
  getContactstudentss,
  getActiveUsers,
  assignContact,
  searchByProduct,
  exportContactsToExcel,
};
