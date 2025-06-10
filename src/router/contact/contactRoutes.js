// contactRoutes.js
const express = require('express');
const router = express.Router();
const {
  createContact,
  getContacts,
  getContactsByAssignedTo,
  updateContact,
  deleteContact,
  getContactsrole,
  getContactstudents,
  findContactsForUser,
  createContactWithRelationship,
} = require('../../controllers/contact.controller');

// Tạo một contact mới
router.post('/createContact', createContact);
router.post('/invalidEndpoint', createContactWithRelationship);
router.put("/contact/:id", updateContact);
// Lấy tất cả các contact findContactsForUser
router.get('/assignedTo/:userId', getContactsByAssignedTo);
router.get('/assignedTos/:userId', findContactsForUser);
router.get('/contacts', getContactsrole);

router.get('/contactsstudents', getContactstudents);
// // Lấy một contact theo ID
// router.get('/:contactId', getContactById);

// // Cập nhật contact theo ID
// router.put('/:contactId', updateContact);

// // Xóa contact theo ID
// router.delete('/:contactId', deleteContact);

module.exports = router;
