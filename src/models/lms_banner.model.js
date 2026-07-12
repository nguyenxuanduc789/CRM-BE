const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const DOCUMENT_NAME = "LMSBanner";
const COLLECTION_NAME = "LMSBanners";

const lmsBannerSchema = new Schema(
  {
    title: { type: String },
    subtitle: { type: String },
    imageUrl: { type: String },
    linkUrl: { type: String },
    buttonText: { type: String, default: "Xem ngay" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

module.exports = model(DOCUMENT_NAME, lmsBannerSchema);
