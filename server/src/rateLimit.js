export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxRequests = 10,
  message = "Too many attempts. Please try again later.",
  keyGenerator = (request) => {
    return (
      request.ip ||
      request.headers["x-forwarded-for"] ||
      request.socket?.remoteAddress ||
      "unknown-client"
    );
  },
} = {}) {
  const records = new Map();

  const cleanupInterval = Math.min(windowMs, 5 * 60 * 1000);
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of records.entries()) {
      const valid = timestamps.filter((time) => now - time < windowMs);
      if (valid.length === 0) {
        records.delete(key);
      } else {
        records.set(key, valid);
      }
    }
  }, cleanupInterval);
  if (timer.unref) {
    timer.unref();
  }

  function rateLimiter(request, response, next) {
    const key = keyGenerator(request);
    const now = Date.now();
    const timestamps = (records.get(key) ?? []).filter(
      (time) => now - time < windowMs,
    );

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      const resetInSeconds = Math.max(
        1,
        Math.ceil((oldest + windowMs - now) / 1000),
      );

      response.set("Retry-After", String(resetInSeconds));
      response.set("RateLimit-Limit", String(maxRequests));
      response.set("RateLimit-Remaining", "0");
      response.set("RateLimit-Reset", String(resetInSeconds));

      response.status(429).json({
        error: message,
        retryAfter: resetInSeconds,
      });
      return;
    }

    timestamps.push(now);
    records.set(key, timestamps);

    const remaining = Math.max(0, maxRequests - timestamps.length);
    response.set("RateLimit-Limit", String(maxRequests));
    response.set("RateLimit-Remaining", String(remaining));

    next();
  }

  rateLimiter.reset = () => {
    records.clear();
  };

  return rateLimiter;
}

