const Contact = require("../models/contact.model");
const Pineline = require("../models/pineline.model");
const User = require("../models/user.model");
const Team = require("../models/team.model");
const ActionLog = require("../models/actionlog.model");
// Tạo một Contact mới
const createContact = async (req, res) => {
  try {
    // Lấy dữ liệu từ body request
    const {
      name,
      email,
      phone,
      assignedTo,
      status,
      interactionLevel,
      notes,
      city,
      country,
      birthDate,
      gender,
      customerSource,
      facebookLink,
      occupation,
      ageGroup,
      maritalStatus,
      numberOfChildren,
      childrenAgeGroup,
      familyNotes,
      interests,
      consultantNotes,
    } = req.body;

    // Kiểm tra xem có liên hệ nào có cùng name và phone không
    const existingContact = await Contact.findOne({ name, phone });
    if (existingContact) {
      return res.status(400).json({
        message:
          "Liên hệ với tên và số điện thoại này đã tồn tại. Vui lòng sử dụng thông tin khác.",
      });
    }

    // Tạo đối tượng contact mới
    const newContact = new Contact({
      name,
      email,
      phone,
      assignedTo,
      status,
      interactionLevel: interactionLevel || "Tư vấn lần 1", // Giá trị mặc định
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

    // Lưu contact vào cơ sở dữ liệu
    await newContact.save();

    // Phản hồi với thông tin đã tạo
    return res.status(201).json({
      message: "Tạo liên hệ thành công!",
      contact: newContact,
    });
  } catch (error) {
    console.error("Lỗi khi tạo liên hệ:", error);
    // Xử lý lỗi
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo liên hệ." });
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
    const { userId } = req.params; // Lấy userId từ params
    const { query } = req.query; // Lấy từ khóa tìm kiếm từ query string

    let searchConditions = { assignedTo: userId };

    if (!isNaN(query) && Number(query).toString() === query) {
      searchConditions.profileCode = Number(query);
    } else if (query.includes("@")) {
      searchConditions.email = { $regex: query, $options: "i" };
    } else if (/^\d+$/.test(query)) {
      searchConditions.phone = { $regex: query, $options: "i" };
    } else {
      searchConditions.name = { $regex: query, $options: "i" };
    }

    const contacts = await Contact.find(searchConditions).populate(
      "assignedTo pipeline"
    );

    if (!contacts || contacts.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy liên hệ nào với thông tin đã cung cấp.",
      });
    }

    return res.status(200).json(contacts);
  } catch (error) {
    console.error(error);
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
    }

    // Tìm các nhóm mà người dùng thuộc về
    const userTeams = await Team.find({
      members: userId,
      status: "active",
    }).populate("leadId");

    // 1. Admin có quyền xem tất cả các liên hệ
    if (role === "Admin") {
      const contacts = await Contact.find({
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 }); // Sort theo profileCode từ lớn đến nhỏ
      return res.status(200).json({ contacts });
    }

    // 2. Lead có quyền xem tất cả các liên hệ của các thành viên trong nhóm mà Lead quản lý
    if (role === "KTT Sale Manager") {
      // const teams = await Team.find({
      //   lead: userId,
      //   status: "active",
      // }).populate("members");
      // const teamMemberIds = teams.map((team) => team.members).flat();
      // const leadIds = teams.map((team) => team.leadId);
      // const allIds = [...teamMemberIds, ...leadIds, userId];

      // const contacts = await Contact.find({
      //   assignedTo: { $in: allIds },
      //   ...filter,
      // })
      //   .populate("assignedTo", "firstname lastname role")
      //   .sort({ profileCode: -1 });

      // return res.status(200).json({ contacts });
      const contacts = await Contact.find({
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 }); // Sort theo profileCode từ lớn đến nhỏ
      return res.status(200).json({ contacts });
    }

    // 3. TeamLead chỉ có thể xem các liên hệ của nhóm mình quản lý
    if (role === "KTT Sale Team Leader") {
      const team = await Team.findOne({
        leadId: userId,
        status: "active",
      }).populate("members");
      const teamMemberIds = team ? team.members : [];
      const allIds = [...teamMemberIds, userId];

      const contacts = await Contact.find({
        assignedTo: { $in: allIds },
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: 1 });

      return res.status(200).json({ contacts });
    }

    // 4. User chỉ có thể xem các liên hệ mà mình được phân công
    if (role === "KTT User") {
      const contacts = await Contact.find({
        assignedTo: userId,
        ...filter,
      })
        .populate("assignedTo", "firstname lastname role")
        .sort({ profileCode: -1 });

      return res.status(200).json({ contacts });
    }

    // Trả về lỗi nếu không được phép truy cập
    return res.status(403).json({ message: "Forbidden" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
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

module.exports = {
  getContactsrole,
  createContact,
  getContacts,
  getContactsByAssignedTo,
  updateContact,
  deleteContact,
  findContactsForUser,
  getContactstudents,
  createContactWithRelationship,
};
