const { model, Schema } = require("mongoose");

const permissionSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
});

module.exports = model("Permission", permissionSchema);
