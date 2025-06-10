const mongoose = require("mongoose");

// Team Schema
const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lead: {
    // Thêm trường lead
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  isPartnership: {
    type: Boolean,
    default: false, // Giá trị mặc định là false
  },
});

module.exports = mongoose.model("Team", teamSchema);
