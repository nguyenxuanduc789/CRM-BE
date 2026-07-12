const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSNotification";
const COLLECTION_NAME = "LMSNotifications";

const lmsNotificationSchema = new Schema(
  {
    recipient: { type: Types.ObjectId, ref: "LMSUser", required: true },
    type: {
      type: String,
      enum: [
        "course_approved",
        "new_enrollment",
        "quiz_graded",
        "qa_reply",
        "payment_success",
        "certificate_issued",
        "system",
      ],
      required: true,
    },
    title: { type: String },
    message: { type: String },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsNotificationSchema);
