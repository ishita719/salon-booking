// Simple in-memory rate limiter (per server instance).
// Good for local/dev and small sites. For heavy production traffic on Vercel, swap for a shared store
// such as Upstash Redis (@upstash/ratelimit) so limits apply across all instances.

import { ApiError } from "./api";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) {
    const mins = Math.ceil((b.resetAt - now) / 60000);
    throw new ApiError(429, `Too many attempts. Please try again in ${mins} minute(s).`);
  }
}
