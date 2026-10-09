const Redis = require("ioredis");

// Initialize Redis from ENV or fallback to local
const redis = new Redis(process.env.REDIS_URI || process.env.REDIS_URL || "redis://localhost:6379");

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis successfully");
});

const cacheMiddleware = (durationInSeconds) => {
  return async (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    // Include query params in the cache key
    const key = `cache:${req.originalUrl || req.url}`;
    
    try {
      const cachedResponse = await redis.get(key);
      if (cachedResponse) {
        return res.status(200).json(JSON.parse(cachedResponse));
      }

      // Intercept res.json to cache the response before sending
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.set(key, JSON.stringify(body), "EX", durationInSeconds).catch(err => console.error("Redis set error:", err));
        }
        originalJson.call(this, body);
      };

      next();
    } catch (err) {
      console.error("Cache middleware error:", err);
      next(); // Fail gracefully
    }
  };
};

// Also expose a function to clear cache by pattern
const clearCache = async (pattern) => {
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error("Clear cache error:", err);
  }
};

module.exports = { redis, cacheMiddleware, clearCache };
