const { model, Schema, Types } = require("mongoose");

const contactSchema = new Schema({
  profileCode: {
    type: Number,
    unique: true, // Đảm bảo rằng mã hồ sơ là duy nhất
  },
  name: {
    type: String,
    required: true,
  },
  email: { type: String, required: false }, // Xóa unique
  phone: {
    type: String,
  },
  assignedTo: {
    type: Types.ObjectId,
    ref: "User", // Người quản lý liên hệ này
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active", // Trạng thái liên hệ
  },
  relativeProfileCode: {
    type: Number,
    ref: "Contact", // Tham chiếu đến profileCode của liên hệ khác
  },
  relationship: {
    type: String,
    enum: ["Vợ/Chồng", "Con", "Bố/Mẹ", "Khác"], // Thêm đầy đủ các giá trị hợp lệ
    required: false,
  },
  pipeline: [
    {
      type: Types.ObjectId,
      ref: "Pipeline", // Giỏ hàng (pipeline) của liên hệ thành công
    },
  ],
  createdAt: { type: Date, default: Date.now },
  interactionLevel: {
    type: String,
    enum: [
      "Tư vấn lần 1", // Khách hàng mới được tư vấn lần đầu
      "Tư vấn lần 2", // Khách hàng đã được tư vấn lần 1 và quay lại tư vấn lần 2
      "Đã thanh toán", // Khách hàng đã mua sản phẩm/dịch vụ hoặc đăng ký khóa học
      "Nợ", // Khách hàng mua hàng/dịch vụ trả góp hoặc còn nợ học phí
      "Tái mua hàng", // Khách hàng đã mua hàng/dịch vụ nhiều lần
      "VIP", // Khách hàng VIP
      "Thân thiết",
      "Khách hàng của affiliate", // Khách hàng thân thiết
    ],
    default: "Tư vấn lần 1", // Mặc định là "Tư vấn lần 1"
  },
  // Các trường mới:
  notes: {
    // Ghi chú cho văn bản dài
    type: String,
    default: "",
  },
  city: {
    // Tỉnh/Thành phố
    type: String,
  },
  country: {
    // Quốc gia
    type: String,
    // Quốc gia là bắt buộc
  },
  birthDate: {
    // Ngày sinh
    type: Date,
  },
  gender: {
    // Giới tính
    type: String,
    enum: ["Nam", "Nữ", "Khác"], // Các giá trị giới tính có thể có
    // Giới tính là bắt buộc
  },
  customerSource: {
    type: String,
    default: "", // Nguồn khách (vd: Facebook, Website, ...)
  },
  facebookLink: {
    type: String,
    default: "", // Link Facebook của khách hàng
  },
  occupation: {
    type: String,
    default: "", // Nghề nghiệp
  },
  ageGroup: {
    type: String,
    default: "", // độ tuổi
  },
  maritalStatus: {
    type: String,
    enum: ["Độc thân", "Đã kết hôn", "Ly hôn", "Khác"], // Tình trạng hôn nhân
    default: "Độc thân",
  },
  numberOfChildren: {
    type: Number, // Số con
    default: 0,
  },
  childrenAgeGroup: {
    type: String, // Độ tuổi con cái
    default: "",
  },
  familyNotes: {
    type: String, // Thông tin thêm về gia đình
    default: "",
  },
  interests: {
    academy: {
      therapyCareer: {
        interestLevel: {
          type: String,
          enum: ["Cơ bản", "Nâng cao", "Chuyên sâu"],
          default: "Cơ bản",
        },
        careerGoals: { type: String, default: "" }, // Mục tiêu học nghề
        startTime: { type: String, default: "" }, // Thời gian dự kiến bắt đầu học
      },
      business: {
        model: { type: String, default: "" }, // Mô hình quan tâm
        scale: { type: String, default: "" }, // Quy mô dự kiến
        investmentCapital: { type: String, default: "" }, // Vốn đầu tư dự kiến
        educationExperience: { type: String, default: "" }, // Kinh nghiệm trong giáo dục
      },
    },
    healthHub: {
      therapyTreatment: {
        healthIssues: { type: String, default: "" }, // Vấn đề sức khỏe
        severityLevel: { type: String, default: "" }, // Mức độ nghiêm trọng
        previousTreatments: { type: String, default: "" }, // Đã từng điều trị
      },
      otherServices: { type: String, default: "" }, // Các dịch vụ khác tại Health Hub
    },
    yogiShop: {
      interestedProducts: { type: String, default: "" }, // Sản phẩm quan tâm
      usagePurpose: { type: String, default: "" }, // Mục đích sử dụng
    },
    otherWishes: {
      internationalWork: {
        desiredCountries: { type: String, default: "" }, // Quốc gia mong muốn làm việc
        workExperience: { type: String, default: "" }, // Kinh nghiệm làm việc quốc tế
      },
      migration: {
        desiredCountries: { type: String, default: "" }, // Quốc gia mong muốn định cư
        reasons: { type: String, default: "" }, // Lý do định cư
      },
      childEducation: {
        childAge: { type: String, default: "" }, // Độ tuổi con
        issues: { type: String, default: "" }, // Vấn đề gặp phải
        wishes: { type: String, default: "" }, // Mong muốn cho con
      },
    },
  },
  consultantNotes: {
    initialImpression: { type: String, default: "" }, // Ấn tượng ban đầu
    hiddenNeeds: { type: String, default: "" }, // Nhu cầu tiềm ẩn
    financialEstimate: { type: String, default: "" }, // Khả năng tài chính
    consultationPlan: { type: String, default: "" }, // Phương án tư vấn phù hợp
    nextSteps: { type: String, default: "" }, // Các bước tiếp theo
  },
});

// Thêm plugin autoIncrement để tự động tăng giá trị của trường profileCode
const autoIncrement = require("mongoose-sequence")(require("mongoose"));
contactSchema.plugin(autoIncrement, { inc_field: "profileCode", start_seq: 0 });

module.exports = model("Contact", contactSchema);
