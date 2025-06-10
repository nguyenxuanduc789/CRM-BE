// Middleware xác thực token JWT
const JWT = require("jsonwebtoken");
const { AuthFailureError } = require("../core/error.response");

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Vui lòng cung cấp token",
    });
  }

  const tokenParts = token.split(" ");
  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Token không hợp lệ",
    });
  }

  const accessToken = tokenParts[1];

  try {
    const decodedToken = JWT.verify(accessToken, process.env.PRIVATE_KEY);

    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Token không hợp lệ hoặc hết hạn",
    });
  }
};

module.exports = authenticateToken; // Xuất middleware như là một hàm
