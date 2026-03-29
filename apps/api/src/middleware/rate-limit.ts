/**
 * Sliding-window rate limiting middleware backed by Redis (ioredis).
 *
 * Two limits are enforced:
 *  • 1 000 req/min per tenant globally
 *  • 100 req/min per tenant per endpoint
 *
 * Returns HTTP 429 with a `Retry-After` header on breach.
 */
import { type Request, type Response, type NextFunction } from 'express';
import Redis from 'ioredis';

const GLOBAL_LIMIT = 1000;
const ENDPOINT_LIMIT = 100;
const WINDOW_SECONDS = 60;

let _redis: Redis | undefined;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL is not set');
    _redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
  }
  return _redis;
}

/** Exposed for testing. */
export function setRedis(client: Redis): void {
  _redis = client;
}

/** Normalise a route path to a stable key segment (strip path params). */
function endpointKey(req: Request): string {
  // Use the matched route pattern when available, else the raw path.
  const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
  return route.replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

async function increment(key: string): Promise<number> {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return count;
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    next();
    return;
  }

  const { tenantId } = req.user;
  const minute = Math.floor(Date.now() / 60_000);
  const ep = endpointKey(req);

  const globalKey = `ratelimit:${tenantId}:global:${minute}`;
  const endpointKeyStr = `ratelimit:${tenantId}:${ep}:${minute}`;

  Promise.all([increment(globalKey), increment(endpointKeyStr)])
    .then(([globalCount, endpointCount]) => {
      if (globalCount > GLOBAL_LIMIT || endpointCount > ENDPOINT_LIMIT) {
        res.set('Retry-After', String(WINDOW_SECONDS));
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: globalCount > GLOBAL_LIMIT
              ? `Tenant global limit of ${GLOBAL_LIMIT} req/min exceeded`
              : `Endpoint limit of ${ENDPOINT_LIMIT} req/min exceeded`,
            traceId: req.traceId,
          },
        });
        return;
      }
      next();
    })
    .catch(() => {
      // Redis unavailable — fail open to avoid blocking all traffic.
      next();
    });
}
