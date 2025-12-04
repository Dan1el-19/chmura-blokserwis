import type { NextRequest } from "next/server";

type Bucket = {
  timestamps: number[];
  windowMs: number;
  limit: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  // NextRequest can expose ip via headers in some runtimes
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function checkRateLimit(
  req: NextRequest,
  routeKey: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const ip = getClientIp(req);
  const key = `${routeKey}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [], windowMs, limit };
    buckets.set(key, bucket);
  } else {
    // if window changed (unlikely), update
    bucket.windowMs = windowMs;
    bucket.limit = limit;
  }
  // prune
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  if (bucket.timestamps.length >= limit) {
    const earliest = bucket.timestamps[0];
    const retryAfter = Math.max(
      0,
      Math.ceil((earliest + windowMs - now) / 1000)
    );
    return { ok: false, retryAfter };
  }
  bucket.timestamps.push(now);
  return { ok: true };
}
