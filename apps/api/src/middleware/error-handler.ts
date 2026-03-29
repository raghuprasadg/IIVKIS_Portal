/**
 * Global error handler.
 *
 * Must be registered as the last middleware with four parameters so Express
 * recognises it as an error handler.
 *
 * Never exposes stack traces in production.
 */
import { type Request, type Response, type NextFunction } from 'express';

const IS_PROD = process.env['NODE_ENV'] === 'production';

/** Structured application error with an HTTP status code. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const traceId = req.traceId ?? 'unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, traceId },
    });
    return;
  }

  // Log the real error server-side.
  // eslint-disable-next-line no-console
  console.error('[error-handler]', { traceId, err });

  const message = IS_PROD ? 'An unexpected error occurred' : String(err);

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message, traceId },
  });
}
