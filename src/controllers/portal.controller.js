const mongoose = require('mongoose');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const Contact = require('../models/contactprotal.model');
const HubPortal = require('../models/HubPortal.model');
const Product = require('../models/product.model');
const PipelinePortal = require('../models/pipeline_portal.model');

// Hàm phân loại sản phẩm - dựa vào category
const isAcademyProduct = (category) => {
  // Kiểm tra category là "Academy"
  return category === 'Academy';
};

const isHubProduct = (category) => {
  // Kiểm tra category là "Health Hub"
  return category === 'Health Hub';
};

exports.getPortalsByContactDate = async (req, res) => {
  try {
    const { userId, startDate, endDate, page = 1, limit = 20, source, search, productSearch, kMin, kMax } = req.query;

    // Kiểm tra đầu vào
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu userId, startDate hoặc endDate' });
    }

    // Chuyển đổi ngày
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Định dạng ngày không hợp lệ' });
    }
    end.setHours(23, 59, 59, 999);

    // Tìm User và Role
    const user = await User.findById(userId).populate('role');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy User' });
    }

    const roleName = user.role?.name;
    if (!roleName) {
      return res.status(400).json({ message: 'User không có vai trò được gán' });
    }

    
    const extractKNumber = (orderId) => {
      if (!orderId || orderId === 'N/A') return null;
      const str = String(orderId).trim();
      let match = str.match(/^K\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
      match = str.match(/^(\d+)$/);
      if (match) return parseInt(match[1], 10);
      return null;
    };

    let contactIds = [];
    let hubPortals = [];
    let pipelinePortals = [];
    let contacts;
    console.log(roleName);
    
    // Xây dựng query cơ bản
    let contactQuery = {
      createdAt: { $gte: start, $lte: end },
    };
    
    // Thêm điều kiện tìm kiếm nếu có
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      contactQuery.$or = [
        { namecusaca: searchRegex },
        { emailcusaca: searchRegex },
        { phonecusaca: searchRegex }
      ];
    }
    
    // Tất cả role đều xem được tất cả dữ liệu
    contacts = await Contact.find(contactQuery).select('idaca namecusaca NguoiGT emailcusaca phonecusaca createdAt Typesource').lean();
    contactIds = contacts.map(contact => contact.idaca);

    hubPortals = await HubPortal.find({
      contactId: { $in: contactIds },
    })
      .populate({
        path: 'productId',
        model: 'Product',
        select: 'name price category productCode',
      })
      
      ;

    pipelinePortals = await PipelinePortal.find({
      contactId: { $in: contactIds },
    })
      .populate({
        path: 'productId',
        model: 'Product',
        select: 'name price category productCode',
      })
      
      ;

    // Kiểm tra contacts
    if (!contacts || contacts.length === 0) {
      console.log('No contacts found for the given criteria.');
      return res.status(200).json({
        message: 'Không tìm thấy contact phù hợp',
        data: [],
        total: 0,
        page: Number(page),
        limit: Number(limit),
      });
    }

    // Tạo contactMap
    const contactMap = new Map();
    contacts.forEach(contact => {
      contactMap.set(contact.idaca, {
        customerName: contact.namecusaca || 'N/A',
        email: contact.emailcusaca || 'N/A',
        phone: contact.phonecusaca || 'N/A',
        nguoiGT: contact.NguoiGT || 'N/A',
        contactCreatedAt: contact.createdAt ? contact.createdAt.toISOString() : 'N/A',
        typesource: contact.Typesource || [],
      });
    });

    // Tất cả role đều nhóm dữ liệu theo contactId
    let result = [];
    const groupedByContact = new Map();

    // Xử lý hubPortals - chỉ lấy sản phẩm Hub
    hubPortals
      .filter(portal => portal.productId && portal.productId.name)
      .filter(portal => isHubProduct(portal.productId.category))
      .forEach(portal => {
        const contactId = portal.contactId;
        if (!groupedByContact.has(contactId)) {
          groupedByContact.set(contactId, {
            contactId,
            ...contactMap.get(contactId),
            products: [],
          });
        }
        groupedByContact.get(contactId).products.push({
          orderId: portal.orderCode || 'N/A',
          productName: portal.productId.name,
          quantity: portal.quantity || 1,
          source: 'HubPortal'
        });
      });

    // Xử lý pipelinePortals - chỉ lấy sản phẩm Academy
    pipelinePortals
      .filter(portal => portal.productId && portal.productId.name)
      .filter(portal => isAcademyProduct(portal.productId.category))
      .forEach(portal => {
        const contactId = portal.contactId;
        if (!groupedByContact.has(contactId)) {
          groupedByContact.set(contactId, {
            contactId,
            ...contactMap.get(contactId),
            products: [],
          });
        }
        groupedByContact.get(contactId).products.push({
          orderId: portal.k || 'N/A',
          productName: portal.productId.name,
          quantity: 1,
          source: 'AcademyPortal'
        });
      });

    // Chuyển Map thành mảng
    result = Array.from(groupedByContact.values());

    // Filter theo source nếu có chỉ định
    if (source) {
      console.log('Filtering by source:', source);
      console.log('Before filtering - total contacts:', result.length);
      result = result.map(contact => ({
        ...contact,
        products: contact.products.filter(product => {
          if (source === 'hub') return product.source === 'HubPortal';
          if (source === 'aca') return product.source === 'AcademyPortal';
          return true;
        })
      })).filter(contact => contact.products.length > 0);
      console.log('After filtering - total contacts:', result.length);
    }

    // Log để debug
    if (result.length === 0) {
      console.log('No valid records found. Check productId or contactIds.');
      console.log('ContactIds:', contactIds);
      console.log('HubPortals:', hubPortals.map(p => ({ contactId: p.contactId, productId: p.productId?._id })));
      console.log('PipelinePortals:', pipelinePortals.map(p => ({ contactId: p.contactId, productId: p.productId?._id })));
    }

    
    // Filter theo productSearch, kMin, kMax
    if (productSearch && productSearch.trim()) {
      const keywords = productSearch.trim().toLowerCase().split(/\s+/);
      result = result.map(item => {
        if (item.products && item.products.length > 0) {
          const matchedProducts = item.products.filter(p => {
            const searchString = `${p.productName || ''} ${p.orderId || ''}`.toLowerCase();
            return keywords.every(kw => searchString.includes(kw));
          });
          if (matchedProducts.length === 0) return null;
          return { ...item, products: matchedProducts };
        }
        return null;
      }).filter(Boolean);
    }
    
    if (kMin || kMax) {
      const min = kMin ? Number(kMin) : null;
      const max = kMax ? Number(kMax) : null;
      result = result.map(item => {
        if (item.products && item.products.length > 0) {
          const matchedProducts = item.products.filter(p => {
            const kNum = extractKNumber(p.orderId);
            if (kNum === null) return false;
            if (min !== null && kNum < min) return false;
            if (max !== null && kNum > max) return false;
            return true;
          });
          if (matchedProducts.length === 0) return null;
          return { ...item, products: matchedProducts };
        }
        return null;
      }).filter(Boolean);
    }

    const total = result.length;
    result = result.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));

    res.status(200).json({
      message: 'Lấy danh sách Portal thành công',
      data: result,
      total: total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách Portal:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = exports;
exports.updatePortalStatus = async (req, res) => {
  try {
    const { id, source, status, graduationStatus } = req.body;
    if (!id || !source) {
      return res.status(400).json({ message: 'Thiếu id hoặc source' });
    }
    
    let updated;
    const updateFields = {};
    if (status !== undefined) updateFields.status = status;
    if (graduationStatus !== undefined) updateFields.graduationStatus = graduationStatus;

    if (source === 'AcademyPortal') {
      const PipelinePortal = require('../models/pipeline_portal.model');
      updated = await PipelinePortal.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
    } else if (source === 'HubPortal') {
      const HubPortal = require('../models/HubPortal.model');
      updated = await HubPortal.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
    }

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy dữ liệu' });
    }

    return res.status(200).json({ message: 'Cập nhật thành công', data: updated });
  } catch (error) {
    console.error('Lỗi updatePortalStatus:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};
