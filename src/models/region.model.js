const { model, Schema } = require("mongoose");

const regionSchema = new Schema({
  name: { type: String, required: true },
  country: { type: String, enum: ["VN", "UK"], required: true },
});

module.exports = model("Region", regionSchema);
