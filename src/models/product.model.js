const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    default: '',
  },
  price: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'unavailable'],
    default: 'available',
  },
  image: { // New image field
    type: String,
    default: '', // Optional: default to empty string if no image is provided
  },
  productCode: {
    type: String,
    required: false,
    unique: true,
  },
  TaxCode: {
    type: String,
    required: false,
   
  },
  vouchers: [
    {
      voucherValue: {
        type: Number,
        required: true,
      },
      voucherType: {
        type: String,
        enum: ['%', 'Amount', 'Coupon'],
        required: true,
      },
      validityPeriodFrom: {
        type: Date,
        required: true,
      },
      validityPeriodTo: {
        type: Date,
        required: true,
      },
      attachedFile: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        enum: ['pending', 'active', 'inactive'],
        required: true,
      },
      note: {
        type: String,
        default: '',
      },
      createdDate: {
        type: Date,
        default: Date.now,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      editLogs: [
        {
          updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          updatedDate: {
            type: Date,
            default: Date.now,
          },
          changes: {
            type: Map,
            of: String,
            required: true,
          },
        },
      ],
    },
  ],
});

// Middleware để tạo mã sản phẩm tự động
// Middleware để tạo mã sản phẩm tự động
productSchema.pre('save', async function (next) {
  if (!this.productCode) {
    console.log('Đang tạo mã sản phẩm...');
    if (this.category === 'Academy') {
      const count = await this.constructor.countDocuments({ category: 'Academy' });
      this.productCode = `Aca_KT${count + 1}`;
    } else if (this.category === 'Health Hub') {
      const count = await this.constructor.countDocuments({ category: 'Health Hub' });
      this.productCode = `HUB_DVTV${count + 1}`;
    } else {
      console.log('Category không hợp lệ, không tạo mã sản phẩm.');
    }
  }
  console.log('Mã sản phẩm sau khi tạo:', this.productCode); // Log giá trị productCode
  next();  // Đảm bảo next() được gọi để tiếp tục lưu sản phẩm
});



module.exports = mongoose.model('Product', productSchema);
