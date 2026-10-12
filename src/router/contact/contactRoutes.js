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
const { cacheMiddleware, clearCache } = require('../../middlewares/redisCache');

// ====================== ROUTES ======================

// ── GET ─────────────────────────────────────────────
router.get('/export-excel',           exportContactsToExcel);
router.get('/users/active',           cacheMiddleware(300), getActiveUsers);
router.get('/contacts',               cacheMiddleware(120), getContactsrole);
router.get('/suggest-contacts',       cacheMiddleware(300), suggestContacts);
router.get('/contactsstudents',       cacheMiddleware(120), getContactstudents);
router.get('/contactsstudentss',      cacheMiddleware(120), getContactstudentss);
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