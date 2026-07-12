const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSQa";
const COLLECTION_NAME = "LMSQas";

const answerSchema = new Schema(
  {
    author: { type: Types.ObjectId, ref: "LMSUser" },
    content: { type: String },
    isInstructor: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const lmsQaSchema = new Schema(
  {
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    activity: { type: Types.ObjectId, ref: "LMSActivity", default: null },
    student: { type: Types.ObjectId, ref: "LMSUser", required: true },
    question: { type: String, required: true },
    answers: [answerSchema],
    isResolved: { type: Boolean, default: false },
    upvotes: [{ type: Types.ObjectId, ref: "LMSUser" }],
    views: { type: Number, default: 0 },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsQaSchema);
