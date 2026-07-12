const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSNote";
const COLLECTION_NAME = "LMSNotes";

const lmsNoteSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "LMSUser", required: true },
    activity: { type: Types.ObjectId, ref: "LMSActivity", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse", required: true },
    timestamp: { type: Number, default: 0 }, // Giây trong video
    content: { type: String, required: true },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsNoteSchema);
