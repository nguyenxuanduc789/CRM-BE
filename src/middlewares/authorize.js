const jwt = require('jsonwebtoken');
const { AuthFailureError } = require('../core/error.response'); // Giả sử bạn đã có module xử lý lỗi

const authorize = (req, res, next) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new AuthFailureError("Token không tồn tại");

    const token = authHeader.split(' ')[1]; // Bearer token
    if (!token) throw new AuthFailureError("Token không hợp lệ");

    // Giải mã token
    const decoded = jwt.verify(token, process.env.PUBLIC_KEY);

    // Lưu thông tin giải mã vào request
    req.user = decoded;

    next(); // Chuyển tiếp đến middleware tiếp theo hoặc xử lý endpoint
  } catch (error) {
    console.error("Lỗi giải mã token:", error.message);
    next(new AuthFailureError("Token không hợp lệ hoặc đã hết hạn"));
  }
};

module.exports = authorize;
