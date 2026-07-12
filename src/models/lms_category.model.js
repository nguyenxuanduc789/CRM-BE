const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const DOCUMENT_NAME = "LMSCategory";
const COLLECTION_NAME = "LMSCategories";

const lmsCategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },
    description: { type: String },
    icon: { type: String }, // emoji string
    color: { type: String, default: "#00B1B0" },
    parentCategory: { type: Schema.Types.ObjectId, ref: "LMSCategory", default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: COLLECTION_NAME }
);

// Tự động tạo slug từ name nếu chưa có
lmsCategorySchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
  next();
});

module.exports = model(DOCUMENT_NAME, lmsCategorySchema);
