// backend/routes/timekeepingRoutes.js
const express = require('express');
const {
  clockInOut,
  getTimekeepingData,  // Ensure this import is correct
} = require('../../controllers/timekeeping.controller');

const router = express.Router();

// Route for clocking in/out
router.post('/timekeeping', clockInOut);

// Route for getting timekeeping data
router.get('/getTimekeepingData', getTimekeepingData); // Ensure this route is correct

module.exports = router;
