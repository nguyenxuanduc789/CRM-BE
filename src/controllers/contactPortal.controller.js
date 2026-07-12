const XLSX = require('xlsx');
const PipelinePortal = require('../models/pipeline_portal.model');
const ContactPortal = require('../models/contactprotal.model');
const Product = require('../models/product.model');

const KEYWORDS = ['thiền', 'yoga', 'coach', 'luân xa'];

/**
 * GET /api/v1/portal/contacts-by-product-type
 * Trả về file Excel danh sách KH Contact Portal
 * đã mua sản phẩm thuộc nhóm: thiền, yoga, coach, khoa học luân xa
 */
const getContactsByProductType = async (req, res) => {
    try {
        // 1. Tìm sản phẩm khớp từ khóa
        const keywordRegex = KEYWORDS.map((kw) => new RegExp(kw, 'i'));
        const matchedProducts = await Product.find({
            name: { $in: keywordRegex },
        }).select('_id name productCode category price');

        if (matchedProducts.length === 0) {
            return res.status(200).json({ message: 'Không tìm thấy sản phẩm phù hợp' });
        }

        const productIds = matchedProducts.map((p) => p._id);

        // 2. Tìm pipeline chứa các sản phẩm đó
        const pipelines = await PipelinePortal.find({
            productId: { $in: productIds },
        }).populate('productId', 'name productCode category price');

        if (pipelines.length === 0) {
            return res.status(200).json({ message: 'Không có khách hàng nào mua sản phẩm thuộc nhóm này' });
        }

        // 3. Gom nhóm pipeline theo contactId
        const contactMap = {};
        for (const pl of pipelines) {
            const cid = pl.contactId;
            if (!contactMap[cid]) contactMap[cid] = [];
            contactMap[cid].push(pl);
        }

        const contactIds = Object.keys(contactMap);

        // 4. Lấy thông tin Contact Portal
        const contacts = await ContactPortal.find({
            idaca: { $in: contactIds },
        }).select('idaca namecusaca phonecusaca emailcusaca Typesource NguoiGT gender address dateOfBirth createdAt');

        // 5. Tạo dữ liệu cho Excel — mỗi dòng = 1 contact x 1 sản phẩm
        const rows = [];
        for (const contact of contacts) {
            const pls = contactMap[contact.idaca] || [];
            for (const pl of pls) {
                const prod = pl.productId;
                rows.push({
                    'ID (idaca)': contact.idaca,
                    'Tên khách hàng': contact.namecusaca || '',
                    'Số điện thoại': contact.phonecusaca || '',
                    'Email': contact.emailcusaca || '',
                    'Giới tính': contact.gender || '',
                    'Địa chỉ': contact.address || '',
                    'Người giới thiệu': contact.NguoiGT || '',
                    'Ngày tạo': contact.createdAt
                        ? new Date(contact.createdAt).toLocaleDateString('vi-VN')
                        : '',
                    'Mã sản phẩm': prod?.productCode || '',
                    'Tên sản phẩm': prod?.name || '',
                    'Danh mục': prod?.category || '',
                    'Giá': prod?.price || 0,
                    'Trạng thái K': pl.k || '',
                    'Ngày mua': pl.createdDate
                        ? new Date(pl.createdDate).toLocaleDateString('vi-VN')
                        : '',
                });
            }
        }

        // 6. Tạo workbook Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        // Căn độ rộng cột tự động
        const colWidths = Object.keys(rows[0] || {}).map((key) => ({
            wch: Math.max(key.length, 20),
        }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const fileName = `KH_thien_yoga_coach_luanxa_${Date.now()}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);

    } catch (error) {
        console.error('Lỗi getContactsByProductType:', error);
        return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

module.exports = { getContactsByProductType };
