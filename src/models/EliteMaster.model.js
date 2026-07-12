const { model, Schema, Types } = require("mongoose");

const eliteMastermindSchema = new Schema(
  {
    // ─── 1. THÔNG TIN CÁ NHÂN & NỀN TẢNG ───────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
    },
    yearOfBirth: {
      type: Number,
    },
    location: {
      type: String,
      trim: true,
    },
    completedCourses: {
      type: [String],
      default: [],
    },
    currentJob: {
      type: String,
      trim: true,
    },

    // ─── 2. ĐỊNH VỊ BẢN THÂN (TẦM NHÌN 3–5 NĂM) ────────────────
    careerDirections: {
      type: [
        {
          type: String,
          enum: [
            "tam_ly_tri_lieu",
            "than_tri_lieu",
            "dao_tao_kinh_doanh",
            "chuyen_gia_tong_luc",
            "khac",
          ],
        },
      ],
      default: [],
    },
    careerDirectionOther: {
      type: String,
      trim: true,
    },

    // ─── 3. KẾ HOẠCH TÀI CHÍNH & HIỆU SUẤT MỤC TIÊU ────────────
    desiredHourlyRate: {
      type: Number,
    },
    targetMonthlyIncome: {
      type: Number,
    },
    targetYearlyIncome: {
      type: Number,
    },
    nicheMarket: {
      type: String,
      trim: true,
    },

    // ─── 4. TÍNH CAM KẾT & KỶ LUẬT ──────────────────────────────
    dailyStudyHours: {
      type: Number,
    },
    dailyStudyTimeSlot: {
      type: String,
      trim: true,
    },
    weeklyClientHours: {
      type: Number,
    },
    disciplineCommitment: {
      type: String,
      enum: ["san_sang", "can_nhac_nho"],
    },

    // ─── 5. TRĂN TRỞ & NHU CẦU ĐƯỢC DẪN DẮT ────────────────────
    biggestFear: {
      type: String,
      trim: true,
    },
    directHelpNeeded: {
      type: String,
      trim: true,
    },
    mentorFocus: {
      type: [
        {
          type: String,
          enum: [
            "ca_benh_kho",
            "tam_ly_khai_van",
            "thuong_hieu_khach",
            "khac",
          ],
        },
      ],
      default: [],
    },
    mentorFocusOther: {
      type: String,
      trim: true,
    },

    // ─── META ────────────────────────────────────────────────────
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "onboarded"],
      default: "pending",
    },
    crmSynced: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const EliteMastermind = model("EliteMastermind", eliteMastermindSchema);

module.exports = EliteMastermind;