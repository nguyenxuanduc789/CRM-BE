const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSQuiz";
const COLLECTION_NAME = "LMSQuizzes";

const optionSchema = new Schema(
  {
    text: { type: String },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: true }
);

const questionSchema = new Schema(
  {
    questionText: { type: String, required: true },
    type: {
      type: String,
      enum: ["single_choice", "multiple_choice", "essay"],
      default: "single_choice",
    },
    options: [optionSchema],
    explanation: { type: String },
    points: { type: Number, default: 1 },
    essayMinWords: { type: Number, default: 0 },
  },
  { _id: true }
);

const lmsQuizSchema = new Schema(
  {
    activity: { type: Types.ObjectId, ref: "LMSActivity", required: true, unique: true },
    title: { type: String },
    description: { type: String },
    questions: [questionSchema],
    passingScore: { type: Number, default: 70 }, // Phần trăm
    timeLimit: { type: Number, default: 0 }, // Phút, 0 = không giới hạn
    allowRetry: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: 3 },
    shuffleQuestions: { type: Boolean, default: false },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsQuizSchema);
