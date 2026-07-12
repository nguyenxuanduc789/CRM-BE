const express = require('express');
const router = express.Router();

const { sendEmailToContact } = require('../../controllers/emailController');
const reminderRoutes = require('./reminderRoutes');

router.post('/send', sendEmailToContact);
router.use(reminderRoutes);

module.exports = router;