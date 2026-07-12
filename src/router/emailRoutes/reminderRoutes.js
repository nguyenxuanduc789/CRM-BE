const express = require('express');
const router = express.Router();
const { sendTuitionReminders } = require('../../cron/cron_remind_tuition');

// POST /api/v1/emailmaketing/remind-tuition
// Gửi email nhắc học phí thủ công (không cần chờ cron)
router.post('/remind-tuition', async (req, res) => {
    try {
        await sendTuitionReminders();
        return res.status(200).json({ success: true, message: 'Đã gửi email nhắc học phí thành công' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Lỗi khi gửi email', error: err.message });
    }
});

module.exports = router;
