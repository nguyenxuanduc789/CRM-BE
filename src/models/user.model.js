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
      required: false, 
      unique: true, 
      sparse: true 
    },
    role: { type: Types.ObjectId, ref: "Role", default: null },
    managedBy: { type: Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["active", "pending approval", "suspended"],
      default: "pending approval",
    },
    region: { type: String },
    province: { type: String },
    employeeCode: { type: String, unique: true },
    profileDetails: {
      dateOfBirth: { type: Date },
      bio: { type: String },
      education: { type: String },
      certifications: { type: String },
      experiences: { type: String },
      motto: { type: String },
      address: { type: String },
      phone: { type: String },
    },
    team: { type: String },
    position: { type: String },
    achievements: [{ type: String }],
    experienceYears: { type: Number },
    university: { type: String },
    specialization: { type: String },
    location: { type: String },
    professionalCertificates: [{ type: String }],
    philosophy: { type: String },
    hobbies: [{ type: String }],
    managedAffiliateIds: { 
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.every(id => /^[a-zA-Z0-9_-]+$/.test(id));
        },
        message: props => `${props.value} chứa giá trị không hợp lệ cho affiliateId!`
      }
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

// Middleware để kiểm tra trùng lặp affiliateId
userSchema.pre("save", async function (next) {
  if (this.isModified("managedAffiliateIds")) {
    const User = model(DOCUMENT_NAME);
    const Affiliate = require('./user.affiliate.model');

    // Lấy tất cả affiliateId từ các Affiliate có managedBy khác với User hiện tại và không phải null
    const existingAffiliates = await Affiliate.find({
      managedBy: { $ne: this._id, $ne: null }
    }).select("affiliateId");

    const existingAffiliateIds = existingAffiliates.map(aff => aff.affiliateId);

    // Kiểm tra trùng lặp với các affiliateId đã được gán cho User khác
    const duplicateIds = this.managedAffiliateIds.filter(id => existingAffiliateIds.includes(id));
    if (duplicateIds.length > 0) {
      throw new Error(`Các affiliateId đã được gán cho user khác: ${duplicateIds.join(", ")}`);
    }

    // Kiểm tra xem các affiliateId có tồn tại trong Affiliate collection không
    const validAffiliateIds = await Affiliate.distinct("affiliateId");
    const invalidIds = this.managedAffiliateIds.filter(id => !validAffiliateIds.includes(id));
    if (invalidIds.length > 0) {
      throw new Error(`Các affiliateId không tồn tại: ${invalidIds.join(", ")}`);
    }
  }
  next();
});

// Middleware để tự động tạo mã nhân viên (bỏ qua nếu không cần)
userSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Role = model("Role");
    const role = await Role.findById(this.role);

    const validRoles = ["KTT Sale Manager", "KTT Sale Team Leader", "KTT User"];
    if (role && validRoles.includes(role.name)) {
      const roleMapping = {
        "KTT Sale Manager": "KTSTH",
        "KTT Sale Team Leader": "KTSTL",
        "KTT User": "KTSTM",
      };

      const rolePrefix = roleMapping[role.name];

      const lastUser = await model(DOCUMENT_NAME)
        .findOne({ employeeCode: new RegExp(`^${rolePrefix}_`) })
        .sort({ employeeCode: -1 });

      let lastIncrement = 0;
      if (lastUser) {
        const match = lastUser.employeeCode.match(/_(\d+)$/);
        if (match) lastIncrement = parseInt(match[1], 10);
      }

      if (role.name === "KTT Sale Manager") {
        this.employeeCode = `${rolePrefix}_${lastIncrement + 1}`;
      } else {
        this.employeeCode = `${rolePrefix}_${(lastIncrement + 1).toString().padStart(4, "0")}`;
      }
    }
  }
  next();
});

module.exports = model(DOCUMENT_NAME, userSchema);