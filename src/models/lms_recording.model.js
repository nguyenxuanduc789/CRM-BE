const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const COLLECTION_NAME = "LMSRecordings";
const DOCUMENT_NAME   = "LMSRecording";

const lmsRecordingSchema = new Schema(
  {
    meetingId:   { type: String, required: true },
    topic:       { type: String },
    hostEmail:   { type: String },
    startTime:   { type: Date },
    endTime:     { type: Date },
    duration:    { type: Number }, // seconds
    fileSize:    { type: Number }, // bytes
    downloadUrl: { type: String },
    playUrl:     { type: String },
    recordingType: { type: String }, // shared_screen_with_speaker_view, gallery_view, etc.
    status:      { type: String, enum: ["processing", "completed", "deleted"], default: "completed" },
    zoomPayload: { type: Schema.Types.Mixed }, // raw Zoom webhook payload
    course:      { type: Types.ObjectId, ref: "LMSCourse" },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsRecordingSchema);
