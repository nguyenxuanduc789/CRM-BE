// models/Pipeline_Portal.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Định nghĩa schema cho Pipeline_Portal
const PipelinePortalSchema = new Schema({
    contactId: {
        type: String,               // Tham chiếu đến idaca trong Contact_Portal
        ref: 'Contact_Portal',      // Tên collection liên kết
        required: true
    },
    productId: {
        type: Schema.Types.ObjectId, // Tham chiếu đến _id trong Product
        ref: 'Product',             // Tên collection liên kết
        required: true
    },
    k: {
        type: String,               // Giá trị K (chuỗi theo yêu cầu của bạn)
        required: true
    },
    createdDate: {
        type: Date,
        default: Date.now           // Tự động ghi thời gian tạo
    },
    updatedDate: {
        type: Date,
        default: Date.now           // Tự động ghi thời gian cập nhật
    }
}, {
    timestamps: {                   // Tự động quản lý createdDate và updatedDate
        createdAt: 'createdDate',
        updatedAt: 'updatedDate'
    }
});

// Tạo model từ schema
const PipelinePortal = mongoose.model('Pipeline_Portal', PipelinePortalSchema);

module.exports = PipelinePortal;