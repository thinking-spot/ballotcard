// In-memory sliding-window rate limiter.
// State is per-process and resets on redeploy — acceptable for a stateless
// Vercel deployment where each cold-start begins fresh.
// For multi-instance deployments, replace this with a Redis-backed limiter.

type Window = {
  timestamps: number[];
};

const store = new Map<string, Window>();

/**
 * Check and record a rate-limit attempt.
 * Returns true if the request is allowed, false if it should be rejected.
 *
 * @param key    Unique key for this limit bucket (e.g. "register:192.0.2.1")
 * @param limit  Maximum requests allowed within the window
 * @param windowMs  Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const entry = store.get(key) ?? { timestamps: [] };

  // Drop timestamps outside the window
  const recent = entry.timestamps.filter((t) => t > cutoff);

  if (recent.length >= limit) {
    store.set(key, { timestamps: recent });
    return false;
  }

  recent.push(now);
  store.set(key, { timestamps: recent });
  return true;
}

// Pre-defined limiters used across server actions
export const limits = {
  /** Registration: 5 per IP per hour */
  register: (ip: string) => checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000),
  /** Login: 10 per IP per 15 minutes */
  login: (ip: string) => checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000),
  /** Password change: 5 per user per hour */
  passwordChange: (userId: string) =>
    checkRateLimit(`pwchange:${userId}`, 5, 60 * 60 * 1000),
  /** OG fetch: 10 per user per minute, 100 per user per day */
  ogFetch: (userId: string) =>
    checkRateLimit(`ogfetch:min:${userId}`, 10, 60 * 1000) &&
    checkRateLimit(`ogfetch:day:${userId}`, 100, 24 * 60 * 60 * 1000),
  /** Post creation: 3 per user per minute, 10 per user per day */
  createPost: (userId: string) =>
    checkRateLimit(`post:min:${userId}`, 3, 60 * 1000) &&
    checkRateLimit(`post:day:${userId}`, 10, 24 * 60 * 60 * 1000),
  /** Replies: 5 per user per minute, 30 per user per day */
  createReply: (userId: string) =>
    checkRateLimit(`reply:min:${userId}`, 5, 60 * 1000) &&
    checkRateLimit(`reply:day:${userId}`, 30, 24 * 60 * 60 * 1000),
};
