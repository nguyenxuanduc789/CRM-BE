const { Schema, model } = require('mongoose');

const DOCUMENT_NAME = 'RishikeshSubmission';
const COLLECTION_NAME = 'rishikesh_submissions';

const rishikeshSubmissionSchema = new Schema(
  {
    // Thông tin hệ thống (từ webhook)
    assessmentId: { type: String },
    submissionId: { type: String, unique: true },
    userId: { type: String },
    userEmail: { type: String },
    userFirstName: { type: String },
    userLastName: { type: String },
    anonId: { type: String },

    // Thông tin form thu thập
    fullName: { type: String }, // Họ và Tên
    phoneNumber: { type: String }, // Số Điện Thoại
    email: { type: String }, // Email
    birthYear: { type: String }, // Năm sinh
    city: { type: String }, // Tỉnh/Thành phố đang sinh sống
    occupation: { type: String }, // Nghề nghiệp hiện tại
    yogaExperience: { type: String }, // Bạn đã từng học hoặc thực hành Yoga/ làm nghề trị liệu bao lâu?
    khiTamPrograms: { type: String }, // Bạn đã từng tham gia chương trình nào của Khí Tâm?
    workingWithClients: { type: String }, // Bạn đang làm việc với khách hàng/học viên?
    interestInRishikesh: { type: [String] }, // Điều gì khiến bạn quan tâm đến chương trình học tại Rishikesh?
    mainGoal: { type: String }, // Mục tiêu lớn nhất bạn muốn đạt được sau chương trình là gì?
    expectedTime: { type: String }, // Bạn dự kiến có thể tham gia chương trình vào thời điểm nào?
    travelAbroadExperience: { type: String }, // Bạn đã từng đi học hoặc du lịch nước ngoài chưa?
    concerns: { type: String }, // Điều gì khiến bạn còn băn khoăn nhất khi tham gia chương trình?
    supportNeeded: { type: String }, // Bạn cần đội ngũ Khí Tâm hỗ trợ thêm nội dung nào?
    additionalQuestions: { type: String }, // Câu hỏi hoặc chia sẻ thêm của bạn

    submittedAt: { type: Date }
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME
  }
);

module.exports = model(DOCUMENT_NAME, rishikeshSubmissionSchema);
