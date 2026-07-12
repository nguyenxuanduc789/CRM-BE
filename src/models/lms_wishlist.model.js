const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const DOCUMENT_NAME = "LMSWishlist";
const COLLECTION_NAME = "LMSWishlists";

const lmsWishlistSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "LMSUser", required: true, unique: true },
    courses: [
      {
        course: { type: Types.ObjectId, ref: "LMSCourse" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsWishlistSchema);
