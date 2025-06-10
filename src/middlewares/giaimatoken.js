const JWT = require("jsonwebtoken");
const { AuthFailureError } = require("../core/error.response");

// Middleware giải mã token và xác thực
const decodeAndVerifyToken = (req, res, next) => {
  const token = req.headers["authorization"]; // Lấy token từ header

  if (!token) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Token không được cung cấp",
    });
  }

  try {
    const tokenParts = token.split(" "); // Tách Bearer và token
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return res.status(401).json({
        status: "error",
        code: 401,
        message: "Header không hợp lệ",
      });
    }

    const decodedToken = JWT.verify(tokenParts[1], process.env.PUBLIC_KEY);

    // Gán thông tin token giải mã được vào req.user
    req.user = decodedToken;

    console.log("Decoded Token: ", decodedToken);

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};

module.exports = decodeAndVerifyToken;
