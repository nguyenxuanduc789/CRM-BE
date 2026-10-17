const crypto = require("crypto");

/**
 * Middleware xác thực chữ ký HMAC từ Đắc Sư (Dac Su App).
 * Format chữ ký: HMAC-SHA256(secret, `${timestamp}.${idempotency}.${body}`)
 * Headers:
 *   - x-dac-su-timestamp: thời gian unix timestamp (giây)
 *   - x-dac-su-idempotency: UUID định danh request
 *   - x-dac-su-signature: chữ ký hex
 *
 * Kiểm tra:
 *   1. Timestamp không lệch quá 5 phút (300s)
 *   2. Timing-safe compare chữ ký
 */
function verifyDacSuHmac(req, res, next) {
  const secret = process.env.CRM_PUSH_HMAC_SECRET;
  if (!secret) {
    console.error("[verifyDacSuHmac] CRM_PUSH_HMAC_SECRET chưa cấu hình trên CRM BE");
    return res.status(500).json({ success: false, message: "CRM_PUSH_HMAC_SECRET is not configured on server" });
  }

  const timestamp = req.headers["x-dac-su-timestamp"];
  const idempotency = req.headers["x-dac-su-idempotency"];
  const signature = req.headers["x-dac-su-signature"];

  if (!timestamp || !signature || !idempotency) {
    console.warn("[verifyDacSuHmac] Missing signature headers:", {
      hasTimestamp: Boolean(timestamp),
      hasIdempotency: Boolean(idempotency),
      hasSignature: Boolean(signature),
    });
    return res.status(401).json({ success: false, message: "Missing x-dac-su-* authentication headers" });
  }

  // Chặn replay attack: timestamp lệch quá 5 phút
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    console.warn("[verifyDacSuHmac] Timestamp out of window:", { now, ts, diff: Math.abs(now - ts) });
    return res.status(401).json({ success: false, message: "Timestamp expired or out of allowed 5-minute window" });
  }

  // Thu thập các dạng body khả dĩ để so sánh an toàn
  const candidates = [];
  if (typeof req.rawBody === "string") {
    candidates.push(req.rawBody);
  }
  try {
    const stringified = JSON.stringify(req.body);
    if (!candidates.includes(stringified)) {
      candidates.push(stringified);
    }
  } catch (e) {
    // ignore
  }

  const sigClean = signature.trim().toLowerCase();

  let isValid = false;
  for (const bodyStr of candidates) {
    const expectedHex = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${idempotency}.${bodyStr}`)
      .digest("hex")
      .toLowerCase();

    if (sigClean.length === expectedHex.length) {
      const left = Buffer.from(sigClean, "utf8");
      const right = Buffer.from(expectedHex, "utf8");
      if (crypto.timingSafeEqual(left, right)) {
        isValid = true;
        break;
      }
    }
  }

  if (!isValid) {
    console.warn("[verifyDacSuHmac] Invalid HMAC signature for path:", req.originalUrl);
    return res.status(401).json({ success: false, message: "Invalid HMAC signature" });
  }

  next();
}

module.exports = verifyDacSuHmac;
