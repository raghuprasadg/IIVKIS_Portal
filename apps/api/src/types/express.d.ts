/**
 * Express Request augmentation — attaches authenticated user context.
 */
import 'express';

declare module 'express' {
  interface Request {
    user?: {
      userId: string;
      tenantId: string;
      roles: string[];
    };
    /** Trace ID propagated from incoming request or generated here. */
    traceId?: string;
  }
}
