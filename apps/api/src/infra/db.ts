import { type Request } from 'express';
import { Pool, type PoolClient } from 'pg';
import { AppError } from '../middleware/error-handler';

let pool: Pool | undefined;

function createPool(): Pool {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new AppError(503, 'DB_UNAVAILABLE', 'DATABASE_URL is not configured');
  return new Pool({ connectionString: url, max: 10 });
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export function setPool(nextPool: Pool): void {
  pool = nextPool;
}

export function getRequestDb(req: Request): PoolClient {
  if (!req.dbClient) {
    throw new AppError(503, 'DB_SESSION_UNAVAILABLE', 'Database session is not available for this request');
  }
  return req.dbClient;
}

declare global {
  namespace Express {
    interface Request {
      dbClient?: PoolClient;
    }
  }
}