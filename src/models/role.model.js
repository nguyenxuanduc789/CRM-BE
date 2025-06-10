const { model, Schema } = require("mongoose");

const roleSchema = new Schema({
  name: {
    type: String,
    enum: [
      "Admin",
      "KTT Sale Manager",
      "KTT Sale Team Leader",
      "KTT User",
      "Accountant", // Translated from "Kế toán"
      "Aca_Specialis",
      "Cust_service",
    ],
    required: true,
    unique: true,
  },
  description: { type: String, default: "" },
});

module.exports = model("Role", roleSchema);
