/**
 * JWT authentication middleware.
 *
 * Validates `Authorization: Bearer <token>`, decodes the JWT,
 * and attaches `req.user = { userId, tenantId, roles }`.
 * Returns 401 for missing/invalid tokens, 403 if tenant claim is absent.
 */
import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
const JWT_ALGORITHMS: jwt.Algorithm[] = ['RS256', 'HS256'];
const IS_PROD = process.env['NODE_ENV'] === 'production';

export interface JwtClaims {
  sub: string;
  tenant_id?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.traceId ??= (req.headers['x-trace-id'] as string | undefined) ?? randomUUID();

  const authHeader = req.headers['authorization'];
  const allowDevBypass = !IS_PROD && process.env['ALLOW_DEV_AUTH_BYPASS'] !== 'false';

  if (!authHeader && allowDevBypass) {
    req.user = {
      userId: (req.headers['x-dev-user-id'] as string | undefined) ?? 'dev-user',
      tenantId: (req.headers['x-dev-tenant-id'] as string | undefined) ?? 'tenant-uat',
      roles: ['tenant-admin'],
    };
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'MISSING_TOKEN', message: 'Authorization header required', traceId: req.traceId },
    });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtClaims;

  try {
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: JWT_ALGORITHMS,
    }) as JwtClaims;
  } catch (err: unknown) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    res.status(401).json({
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired ? 'Token has expired' : 'Invalid or malformed token',
        traceId: req.traceId,
      },
    });
    return;
  }

  if (!payload.tenant_id) {
    res.status(403).json({
      error: { code: 'MISSING_TENANT', message: 'Token is missing tenant_id claim', traceId: req.traceId },
    });
    return;
  }

  req.user = {
    userId: payload.sub,
    tenantId: payload.tenant_id,
    roles: payload.roles ?? [],
  };

  next();
}
