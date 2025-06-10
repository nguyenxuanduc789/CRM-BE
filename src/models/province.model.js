const { model, Schema } = require("mongoose");
const provinceSchema = new Schema({
  name: { type: String, required: true },
  region: { type: Schema.Types.ObjectId, ref: "Region", required: true },

});

module.exports = model("Province", provinceSchema);
