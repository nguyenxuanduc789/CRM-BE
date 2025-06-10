// Middleware giả lập cho việc test
const mockAuth = (req, res, next) => {
    // Giả lập user xác thực
    req.user = {
      id: "6673b41f56d8b67ed4a5465e", // Thay thế ID này bằng ID hợp lệ trong cơ sở dữ liệu hoặc giả định
      email: "ducprokb131234@gmail.com",
    };
    next();
  };
  
module.exports = mockAuth;
  