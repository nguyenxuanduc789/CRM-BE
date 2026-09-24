const Product = require('../models/product.model');
const Pipeline = require('../models/pineline.model');
const Pipeline_Portal = require('../models/pipeline_portal.model');
const HubPortal = require('../models/HubPortal.model');
const Contact = require('../models/contact.model');
const Contact_Portal = require('../models/contactprotal.model');
const xlsx = require('xlsx');

class ExportController {
  static async export200h300h(req, res) {
    try {
      const products = await Product.find({ name: { $regex: /200h|300h/i } });
      const productIds = products.map(p => p._id);
      
      const results = [];

      // 1. Pipelines
      const pipelines = await Pipeline.find({ products: { $in: productIds } })
        .populate('contact')
        .populate('products')
        .lean();
      
      for (const p of pipelines) {
        if (p.contact) {
          const prods = p.products.filter(pr => productIds.some(pid => pid.equals(pr._id))).map(pr => pr.name).join(', ');
          results.push({
            Nguon_Du_Lieu: 'CRM Pipeline',
            Ten_Khach_Hang: p.contact.name,
            So_Dien_Thoai: p.contact.phone,
            Email: p.contact.email,
            Khoa_Hoc: prods,
            Ngay_Tao: p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : ''
          });
        }
      }

      // 2. Pipeline_Portal
      const pipelinePortals = await Pipeline_Portal.find({ productId: { $in: productIds } }).populate('productId').lean();
      const ppContactIds = [...new Set(pipelinePortals.map(p => p.contactId))];
      const ppContacts = await Contact_Portal.find({ idaca: { $in: ppContactIds } }).lean();
      const ppContactMap = Object.fromEntries(ppContacts.map(c => [c.idaca, c]));

      for (const pp of pipelinePortals) {
        const contact = ppContactMap[pp.contactId];
        if (contact) {
          results.push({
            Nguon_Du_Lieu: 'Pipeline Portal',
            Ten_Khach_Hang: contact.namecusaca,
            So_Dien_Thoai: contact.phonecusaca,
            Email: contact.emailcusaca,
            Khoa_Hoc: pp.productId ? pp.productId.name : '',
            Ngay_Tao: pp.createdDate ? new Date(pp.createdDate).toLocaleString('vi-VN') : ''
          });
        }
      }

      // 3. Hub_Portal
      const hubPortals = await HubPortal.find({ productId: { $in: productIds } }).populate('productId').lean();
      const hpContactIds = [...new Set(hubPortals.map(p => p.contactId))];
      const hpContacts = await Contact_Portal.find({ idaca: { $in: hpContactIds } }).lean();
      const hpContactMap = Object.fromEntries(hpContacts.map(c => [c.idaca, c]));

      for (const hp of hubPortals) {
        const contact = hpContactMap[hp.contactId];
        if (contact) {
          results.push({
            Nguon_Du_Lieu: 'Hub Portal',
            Ten_Khach_Hang: contact.namecusaca,
            So_Dien_Thoai: contact.phonecusaca,
            Email: contact.emailcusaca,
            Khoa_Hoc: hp.productId ? hp.productId.name : '',
            Ngay_Tao: hp.createdDate ? new Date(hp.createdDate).toLocaleString('vi-VN') : ''
          });
        }
      }

      const ws = xlsx.utils.json_to_sheet(results);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Khach_Hang_200H_300H");
      
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Danh_Sach_200H_300H.xlsx"');
      
      return res.send(buffer);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Lỗi xuất file Excel", error: error.message });
    }
  }
}

module.exports = ExportController;
