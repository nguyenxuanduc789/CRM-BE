const jwt = require("jsonwebtoken");

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return next();

  const token = authHeader.split(" ")[1];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.PUBLIC_KEY);
  } catch {
    // Ignore invalid token for public LMS browsing
  }
  next();
};

module.exports = optionalAuth;
