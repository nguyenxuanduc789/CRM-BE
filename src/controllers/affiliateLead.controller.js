const AffiliateLead = require("../models/affiliateLead.model");

exports.createLead = async (req, res) => {
  try {
    const { fullName, email, phone, affiliateCode } = req.body;
    const lead = await AffiliateLead.create({ fullName, email, phone, affiliateCode });
    res.status(201).json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeads = async (req, res) => {
  try {
    const leads = await AffiliateLead.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
