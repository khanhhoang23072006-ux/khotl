import { Redis } from "ioredis";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** số giây tới khi cửa sổ được làm mới */
  resetIn: number;
}

export interface RateLimiter {
  /** Đếm một lượt cho `key`; trả về ok=false nếu đã vượt `limit` trong `windowSec`. */
  hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult>;
}

/**
 * Cửa sổ cố định trên Redis (INCR + EXPIRE trong một lệnh MULTI).
 * Chạy được với Redis tự host lẫn Upstash (Upstash hỗ trợ giao thức Redis qua rediss://).
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const results = await this.redis.multi().incr(bucket).expire(bucket, windowSec).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const resetIn = windowSec - (Math.floor(Date.now() / 1000) % windowSec);
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetIn };
  }
}

/** Bộ đếm trong bộ nhớ tiến trình: chỉ dùng khi dev hoặc chạy một instance. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async hit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
    const now = Date.now();
    const current = this.buckets.get(key);
    const entry =
      current && current.expiresAt > now ? current : { count: 0, expiresAt: now + windowSec * 1000 };
    entry.count += 1;
    this.buckets.set(key, entry);
    if (this.buckets.size > 10_000) this.sweep(now);
    return {
      ok: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      resetIn: Math.ceil((entry.expiresAt - now) / 1000),
    };
  }

  private sweep(now: number) {
    for (const [key, entry] of this.buckets) {
      if (entry.expiresAt <= now) this.buckets.delete(key);
    }
  }
}

let shared: RateLimiter | undefined;

export function getRateLimiter(env: NodeJS.ProcessEnv = process.env): RateLimiter {
  if (!shared) {
    shared = env.REDIS_URL
      ? new RedisRateLimiter(new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false }))
      : new MemoryRateLimiter();
  }
  return shared;
}
