const Redis = require("ioredis");

// Initialize Redis from ENV or fallback to local. Add maxRetriesPerRequest to avoid hanging on connection failure.
const redis = new Redis(process.env.REDIS_URI || process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 50, 2000);
  }
});

let isRedisConnected = false;

redis.on("error", (err) => {
  // console.error("Redis connection failed, cache will be bypassed.");
  isRedisConnected = false;
});

redis.on("connect", () => {
  console.log("Connected to Redis successfully");
  isRedisConnected = true;
});

const cacheMiddleware = (durationInSeconds) => {
  return async (req, res, next) => {
    if (req.method !== "GET" || !isRedisConnected) {
      return next(); // Bypass cache safely if redis is down
    }

    const key = `cache:${req.originalUrl || req.url}`;
    
    try {
      const cachedResponse = await redis.get(key);
      if (cachedResponse) {
        return res.status(200).json(JSON.parse(cachedResponse));
      }

      // Intercept res.json to cache the response before sending
      const originalJson = res.json;
      res.json = function (body) {
        if (isRedisConnected && res.statusCode >= 200 && res.statusCode < 300) {
          redis.set(key, JSON.stringify(body), "EX", durationInSeconds).catch(() => {});
        }
        originalJson.call(this, body);
      };

      next();
    } catch (err) {
      next(); // Fail gracefully
    }
  };
};

const clearCache = async (pattern) => {
  if (!isRedisConnected) return;
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {}
};

module.exports = { redis, cacheMiddleware, clearCache };
