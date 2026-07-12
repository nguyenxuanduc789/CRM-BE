const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSZoomMeeting";
const COLLECTION_NAME = "LMSZoomMeetings";

const lmsZoomMeetingSchema = new Schema(
  {
    topic: { type: String, required: true },
    meetingId: { type: String, required: true },
    passcode: { type: String },
    startUrl: { type: String }, // For host to start
    joinUrl: { type: String },  // For participants to join via Zoom App
    startTime: { type: Date, required: true },
    duration: { type: Number, required: true }, // In minutes
    host: { type: Types.ObjectId, ref: "User", required: true },
    course: { type: Types.ObjectId, ref: "LMSCourse" },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, lmsZoomMeetingSchema);
