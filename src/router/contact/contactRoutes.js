const express = require('express');
const router = express.Router();

const {
  createContact,
  getContactsrole,
  getContactsByAssignedTo,
  findContactsForUser,
  suggestContacts,
  getContactstudents,
  getContactstudentss,
  getActiveUsers,
  updateContact,
  assignContact,
  createContactWithRelationship,
  importContactsFromExcel,
  uploadExcelMiddleware,
  searchByProduct,
  exportContactsToExcel,
} = require('../../controllers/contact.controller');

// ====================== ROUTES ======================

// ── GET ─────────────────────────────────────────────
router.get('/export-excel',           exportContactsToExcel);
router.get('/users/active',           getActiveUsers);
router.get('/contacts',               getContactsrole);
router.get('/suggest-contacts',       suggestContacts);
router.get('/contactsstudents',       getContactstudents);
router.get('/contactsstudentss',      getContactstudentss);
router.get('/searchbyproduct', searchByProduct);

router.get('/assignedTo/:userId',     getContactsByAssignedTo);
router.get('/assignedTos/:userId',    findContactsForUser);

// ── POST ────────────────────────────────────────────
router.post('/createContact',         createContact);

// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
router.post('/importContactsFromExcel',   // ←←← ĐÃ SỬA TÊN ROUTE
  uploadExcelMiddleware,                  // Multer phải đứng trước
  importContactsFromExcel
);
// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

router.post('/addRelationship',       createContactWithRelationship); // đổi tên cho rõ ràng hơn

// ── PUT / PATCH ─────────────────────────────────────
router.put('/contact/:id',            updateContact);
router.patch('/assign/:contactId',    assignContact);

module.exports = router;