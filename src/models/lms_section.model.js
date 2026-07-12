const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSSection";
const COLLECTION_NAME = "LMSSections";

const lmsSectionSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    activities: [{ type: Types.ObjectId, ref: "LMSActivity" }], // Ordered list of activities
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, lmsSectionSchema);
