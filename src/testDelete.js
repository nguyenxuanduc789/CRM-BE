const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.LMS_JWT_SECRET || "khitam_lms_super_secret_jwt_2025";

// Tạo token giả cho trainer
const token = jwt.sign(
  { _id: "60c72b2f9b1d8b2bad000001", role: "trainer", email: "ducprokb123@gmail.com" },
  JWT_SECRET,
  { expiresIn: '1h' }
);

axios.delete('http://localhost:3056/api/lms/admin/zoom-meetings/60c72b2f9b1d8b2bad000001', {
  headers: { Authorization: `Bearer ${token}` }
})
.then(res => {
  console.log('Response:', res.data);
})
.catch(err => {
  console.log('Error status:', err.response?.status);
  console.log('Error message:', err.response?.data);
});
