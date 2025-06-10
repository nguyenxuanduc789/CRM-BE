const { model, Schema, Types } = require("mongoose");

const DOCUMENT_NAME = "User";
const COLLECTION_NAME = "Users";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    lastname: { type: String, required: true },
    firstname: { type: String, required: true },
    password: { type: String, required: true },
    code_aff: { 
      type: Number, 
      required: false, // Có thể không bắt buộc nếu không phải user nào cũng là affiliate
      unique: true, // Đảm bảo mã affiliate là duy nhất
      sparse: true // Cho phép null nhưng vẫn giữ tính duy nhất
    },
    role: { type: Types.ObjectId, ref: "Role", default: null  }, // Vai trò, không bắt buộc
    managedBy: { type: Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["active", "pending approval", "suspended"],
      default: "pending approval",
    },
    region: { type: String }, // Quốc gia
    province: { type: String }, // Thành phố
    employeeCode: { type: String, unique: true }, // Mã nhân viên
    profileDetails: {
      dateOfBirth: { type: Date }, // Ngày sinh
      bio: { type: String }, // Giới thiệu bản thân
      education: { type: String }, // Học vấn (danh sách)
      certifications: { type: String }, // Chứng chỉ
      experiences: { type: String }, // Kinh nghiệm làm việc
      motto: { type: String }, // Phương châm sống
      address: { type: String }, // Địa chỉ
      phone: { type: String }, // Số điện thoại
    },
    team: { type: String }, // Đội ngũ
    position: { type: String }, // Vị trí (ví dụ: Ban giảng huấn)
    achievements: [{ type: String }], // Thành tựu cá nhân
    experienceYears: { type: Number }, // Số năm kinh nghiệm
    university: { type: String }, // Trường đại học
    specialization: { type: String }, // Chuyên ngành
    location: { type: String }, // Địa điểm (địa chỉ cụ thể)
    professionalCertificates: [{ type: String }], // Chứng chỉ chuyên môn
    philosophy: { type: String }, // Triết lý sống
    hobbies: [{ type: String }], // Sở thích
    aff: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);
userSchema.pre("save", async function (next) {
  if (this.isModified("aff")) {
    const User = model(DOCUMENT_NAME);
    // Lấy tất cả affiliate_id đã được gán cho các user khác
    const existingAffiliateIds = await User.distinct("aff", {
      _id: { $ne: this._id }, // Loại trừ chính user hiện tại
    });

    // Kiểm tra xem có affiliate_id nào trong mảng aff của user hiện tại đã tồn tại ở user khác
    const duplicateIds = this.aff.filter((id) => existingAffiliateIds.includes(id));
    if (duplicateIds.length > 0) {
      throw new Error(`Các affiliate_id đã được gán cho user khác: ${duplicateIds.join(", ")}`);
    }
  }
  next();
});
// Middleware để tự động tạo mã nhân viên
// userSchema.pre("save", async function (next) {
//   if (this.isNew) {
//     const Role = model("Role");
//     const role = await Role.findById(this.role);

//     const validRoles = ["KTT Sale Manager", "KTT Sale Team Leader", "KTT User"];
//     if (role && validRoles.includes(role.name)) {
//       const roleMapping = {
//         "KTT Sale Manager": "KTSTH",
//         "KTT Sale Team Leader": "KTSTL",
//         "KTT User": "KTSTM",
//       };

//       const rolePrefix = roleMapping[role.name];

//       const lastUser = await model(DOCUMENT_NAME)
//         .findOne({ employeeCode: new RegExp(`^${rolePrefix}_`) })
//         .sort({ employeeCode: -1 });

//       let lastIncrement = 0;
//       if (lastUser) {
//         const match = lastUser.employeeCode.match(/_(\d+)$/);
//         if (match) lastIncrement = parseInt(match[1], 10);
//       }

//       if (role.name === "KTT Sale Manager") {
//         this.employeeCode = `${rolePrefix}_${lastIncrement + 1}`;
//       } else {
//         this.employeeCode = `${rolePrefix}_${(lastIncrement + 1)
//           .toString()
//           .padStart(4, "0")}`;
//       }
//     }
//   }
//   next();
// });

module.exports = model(DOCUMENT_NAME, userSchema);
