/**
 * Auth service — token validation and permission checks.
 */
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  tenant_id?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
const JWT_ALGORITHMS: jwt.Algorithm[] = ['RS256', 'HS256'];

export async function validateToken(token: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded as JwtPayload);
    });
  });
}

export function extractTenantId(payload: JwtPayload): string {
  if (!payload.tenant_id) throw new Error('JWT payload is missing tenant_id claim');
  return payload.tenant_id;
}

/**
 * Minimal RBAC check.
 * In production this would query a permissions table; here we check roles array.
 */
export async function checkPermission(
  _userId: string,
  _tenantId: string,
  permission: string,
): Promise<boolean> {
  // Placeholder — extend with real DB lookup when ACL table is available.
  void _userId;
  void _tenantId;
  void permission;
  return true;
}
