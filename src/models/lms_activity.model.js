const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSActivity";
const COLLECTION_NAME = "LMSActivities";

const lmsActivitySchema = new Schema(
  {
    title: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["video", "pdf", "scorm", "zoom_meeting", "text", "quiz"], 
      required: true 
    },
    section: { type: Types.ObjectId, ref: "LMSSection", required: true },
    order: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    
    // Dữ liệu nội dung tùy theo 'type'
    content: {
      videoUrl: { type: String },
      pdfUrl: { type: String },
      textContent: { type: String },
      zoomMeetingId: { type: Types.ObjectId, ref: "LMSZoomMeeting" },
      scormUrl: { type: String },
    },
    
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    isRequired: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, lmsActivitySchema);
