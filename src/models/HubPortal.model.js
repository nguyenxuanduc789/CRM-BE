const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HubPortalSchema = new Schema({
    contactId: {
        type: String,
        required: true
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: {
        type: Number,
        default: 1
    },
    paymentDate: {
        type: String,
        default: ''
    },
    createdDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'createdDate', updatedAt: 'updatedDate' }
});

module.exports = mongoose.model('HubPortal', HubPortalSchema);