/**
 * RBAC + ABAC enforcement middleware (Phase 7 — Security).
 *
 * Usage:
 *   router.get('/incidents', rbac('incident:read'), handler);
 *   router.delete('/incidents/:id', rbac('incident:delete'), handler);
 *
 * The middleware:
 *   1. Extracts the ABACSubject from `req.user` (populated by authMiddleware).
 *   2. Builds an ABACResource from the request context.
 *   3. Calls the OPA policy engine to get a PolicyDecision.
 *   4. Returns 403 with structured error on deny, or calls next() on allow.
 *
 * Tenant isolation is enforced by OPA rule 'tenant-isolation': the resource
 * tenantId is always set to `req.user.tenantId`, so cross-tenant access is
 * structurally impossible regardless of what resource IDs are supplied.
 */

import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { evaluate } from '../security/opa';
import type { ABACSubject, ABACResource, Permission, RoleName } from '@iivkis/shared';

/**
 * Factory: returns a middleware that enforces the given permission.
 *
 * @param permission  The required permission (e.g. 'incident:read').
 * @param resourceType  Override for the resource type string (defaults to the
 *                      first segment of the URL path after /api/v1/).
 */
export function rbac(permission: Permission, resourceType?: string): RequestHandler {
  return function rbacMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          traceId: req.traceId,
        },
      });
      return;
    }

    const subject: ABACSubject = {
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      roles: req.user.roles as RoleName[],
      attributes: {},
    };

    // Infer resource type from URL if not supplied
    const inferredType =
      resourceType ??
      req.path.split('/').filter(Boolean)[0] ??
      'unknown';

    const resource: ABACResource = {
      type: inferredType,
      // Tenant isolation: always use the authenticated user's tenant
      tenantId: req.user.tenantId,
      attributes: {},
      ...(req.params['id'] !== undefined && { id: req.params['id'] }),
    };

    evaluate({
      subject,
      resource,
      action: permission,
      now: new Date().toISOString(),
    })
      .then((decision) => {
        if (!decision.allow) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: `Insufficient permissions for ${permission}`,
              detail: decision.reason,
              ruleId: decision.ruleId,
              traceId: req.traceId,
            },
          });
          return;
        }
        next();
      })
      .catch((err) => {
        // Policy engine error — fail closed (deny)
        res.status(403).json({
          error: {
            code: 'POLICY_ERROR',
            message: 'Policy evaluation failed',
            detail: err instanceof Error ? err.message : String(err),
            traceId: req.traceId,
          },
        });
      });
  };
}

/**
 * Convenience helper: require that the requesting user has at least one of the
 * given roles. Useful for coarse-grained admin-only route guards.
 */
export function requireRoles(...roles: RoleName[]): RequestHandler {
  return function requireRolesMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required', traceId: req.traceId },
      });
      return;
    }

    const userRoles = req.user.roles as RoleName[];
    const hasRequiredRole = roles.some((r) => userRoles.includes(r));

    if (!hasRequiredRole) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Role requirement not met. Requires one of: ${roles.join(', ')}`,
          traceId: req.traceId,
        },
      });
      return;
    }
    next();
  };
}
