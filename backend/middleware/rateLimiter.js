const buckets = new Map();

// Periodically clear expired buckets so the Map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetTime <= now) buckets.delete(key);
  }
}, 60_000).unref();

/**
 * Rate limiter that only counts *failures*.
 *
 * This is what you want for sign-in endpoints. A plain request counter also
 * blocks legitimate use: several people logging in from the same shop
 * computer, or a customer on shared mobile data, would each count towards the
 * limit and eventually lock out a valid customer. Counting only rejected
 * attempts stops brute force without that side effect.
 */
const failedAttemptLimiter = ({
  windowMs = 15 * 60_000,
  max = 10,
  message = "Too many failed attempts. Please try again in a few minutes.",
  statuses = [401, 403, 429],
} = {}) =>
  (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    const current = () => {
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetTime <= now) {
        buckets.delete(key);
        return null;
      }
      return bucket;
    };

    // Already over the limit -> refuse before doing any work.
    const existing = current();
    if (existing && existing.count >= max) {
      const retryAfter = Math.ceil((existing.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);

      return res.status(429).json({
        success: false,
        message,
        retryAfter,
      });
    }

    // Otherwise let the request through and judge it by the response.
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const shouldCount = statuses.includes(res.statusCode);

      if (shouldCount) {
        const bucket = existing && existing.resetTime > now
          ? existing
          : { count: 0, resetTime: now + windowMs };

        bucket.count += 1;
        buckets.set(key, bucket);

        res.setHeader("X-RateLimit-Remaining", Math.max(0, max - bucket.count));
      } else {
        // A success means the credentials were right, so clear the slate.
        buckets.delete(key);
      }

      return originalJson(body);
    };

    return next();
  };

/**
 * Counts every request regardless of outcome. Use for expensive or
 * abusable-but-harmless endpoints (e.g. the contact form).
 */
const requestLimiter = ({ windowMs = 60_000, max = 100, message } = {}) =>
  (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetTime <= now) {
      bucket = { count: 0, resetTime: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetTime / 1000));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);

      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please try again shortly.",
        retryAfter,
      });
    }

    return next();
  };

module.exports = { failedAttemptLimiter, requestLimiter };
