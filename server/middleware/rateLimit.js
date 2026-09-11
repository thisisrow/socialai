/**
 * Small in-memory fixed-window limiter. No Redis dependency, which is fine for a
 * single instance. Behind multiple instances, swap the Map for a shared store.
 */
const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

function rateLimit({ windowMs = 60_000, max = 60, keyPrefix = "", message } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const identity = String(req.body?.email || "").toLowerCase();
    const key = `${keyPrefix}:${ip}:${identity}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message || `Too many requests. Try again in ${retryAfter}s.`,
        code: "rate_limited",
      });
    }
    return next();
  };
}

module.exports = { rateLimit };
