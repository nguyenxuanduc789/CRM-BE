const JWT = require("jsonwebtoken");
const { asyncHandler } = require("../helpers/asyncHandler");
const { AuthFailureError } = require("../core/error.response");

const HEADERS = {
  AUTHORIZATION: "authorization",
};

const permissions = {
  admin: {
    courses: ["create", "update", "delete", "view"],
    users: ["create", "update", "delete", "view"],
  },
  instructor: {
    courses: ["create", "update", "view"],
    users: ["view"],
  },
  student: {
    courses: ["view"],
    users: ["view"],
  },
};

// Tạo token không có thời gian hết hạn
const createTokenPair = async (payload, publicKey, privateKey) => {
  try {
    // Tạo accessToken không có thời gian hết hạn (không có expiresIn)
    const accessToken = JWT.sign(payload, privateKey); // Không có expiresIn
    const refreshToken = JWT.sign(payload, privateKey, {
      expiresIn: "7 days", // Refresh token có thể có thời gian hết hạn
    });

    // Optional: Verify access token
    JWT.verify(accessToken, publicKey, (err, decode) => {
      if (err) {
        console.error(`Error verifying access token:`, err);
      } else {
        // Vẫn ghi log khi xác minh token
        console.log(`Decoded access token:`, decode);
      }
    });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error(`Error creating token pair:`, error);
    return {
      code: "xxx5",
      message: error.message,
      status: "error",
    };
  }
};

// Kiểm tra quyền truy cập
const permissionAccess = (role, resource, action) => {
  return (
    permissions[role] &&
    permissions[role][resource] &&
    permissions[role][resource].includes(action)
  );
};

// Middleware xác thực token
const authenticationV2 = asyncHandler(async (req, res, next) => {
  const accessToken = req.headers[HEADERS.AUTHORIZATION];
  if (!accessToken) {
    throw new AuthFailureError("Authorization header not found");
  }

  try {
    const tokenParts = accessToken.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      throw new AuthFailureError("Invalid authorization header format");
    }

    const token = tokenParts[1];

    // Xác thực token mà không kiểm tra hết hạn (Token không hết hạn)
    const decodedToken = JWT.verify(token, process.env.PUBLIC_KEY, {
      ignoreExpiration: true, // Không kiểm tra thời gian hết hạn
    });

    // Kiểm tra và ghi nhật ký vai trò người dùng
    console.log(`Vai trò người dùng: ${decodedToken.role}`);

    const controller = req._parsedUrl.pathname.split("/")[1];
    const action = req._parsedUrl.pathname.split("/")[2];

    if (!permissionAccess(decodedToken.role, controller, action)) {
      throw new AuthFailureError("Người dùng không có quyền truy cập");
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    // Xử lý các loại lỗi cụ thể ở đây
    if (error instanceof AuthFailureError) {
      res
        .status(401)
        .json({ status: "error", code: 401, message: error.message });
    } else {
      next(error); // Xử lý các lỗi khác
    }
  }
});

module.exports = {
  authenticationV2,
  createTokenPair,
};
