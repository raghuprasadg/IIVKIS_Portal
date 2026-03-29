/**
 * mTLS client-certificate verification middleware (Phase 7 — Security).
 *
 * When MTLS_REQUIRED=true, every request must carry a valid TLS client
 * certificate (verified by the TLS terminator / load balancer).
 *
 * In Kubernetes the Istio sidecar or an Nginx ingress performs the actual TLS
 * handshake and forwards the verified cert DN as HTTP headers:
 *   X-Client-Cert-Subject  — e.g. "CN=portal-service,O=IIVKIS,OU=services"
 *   X-Client-Cert-Serial   — hex serial number
 *   X-Client-Cert-Verified — "SUCCESS" | "FAILED" | "NONE"
 *   X-Client-Cert-NotAfter — RFC 3339 expiry
 *   X-Client-Cert-Fingerprint — SHA-256 hex fingerprint
 *
 * The middleware:
 *  1. Checks that X-Client-Cert-Verified == "SUCCESS".
 *  2. Parses the subject DN and builds a ClientCertIdentity.
 *  3. Attaches the identity to req.clientCert for downstream use.
 *  4. Validates the cert is not expired.
 *  5. (Optional) checks the CN against an allowlist from env var
 *     MTLS_ALLOWED_CNS (comma-separated).
 *
 * When MTLS_REQUIRED is not set the middleware is a no-op pass-through,
 * allowing plain-HTTP operation in development.
 */

import { type Request, type Response, type NextFunction } from 'express';
import type { ClientCertIdentity } from '@iivkis/shared';

const MTLS_REQUIRED = process.env['MTLS_REQUIRED'] === 'true';
const MTLS_ALLOWED_CNS: string[] | null =
  process.env['MTLS_ALLOWED_CNS']
    ? process.env['MTLS_ALLOWED_CNS'].split(',').map((s) => s.trim()).filter(Boolean)
    : null;

// Augment Express Request with clientCert
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clientCert?: ClientCertIdentity;
    }
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Parse a simple X.509 DN string "CN=foo,O=bar,OU=baz" into a map. */
function parseDN(dn: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of dn.split(',')) {
    const eq = part.indexOf('=');
    if (eq >= 0) {
      parts[part.slice(0, eq).trim().toUpperCase()] = part.slice(eq + 1).trim();
    }
  }
  return parts;
}

/* ── middleware ──────────────────────────────────────────────────────────── */

export function mtlsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // No-op in development
  if (!MTLS_REQUIRED) {
    next();
    return;
  }

  const verifiedHeader = req.headers['x-client-cert-verified'];
  const verified = Array.isArray(verifiedHeader) ? verifiedHeader[0] : verifiedHeader;

  if (verified !== 'SUCCESS') {
    res.status(401).json({
      error: {
        code: 'MTLS_REQUIRED',
        message: 'A valid client certificate is required',
        detail: `x-client-cert-verified: ${verified ?? 'missing'}`,
        traceId: req.traceId,
      },
    });
    return;
  }

  const subjectHeader = req.headers['x-client-cert-subject'];
  const subject = Array.isArray(subjectHeader) ? subjectHeader[0] : subjectHeader;
  if (!subject) {
    res.status(401).json({
      error: {
        code: 'MTLS_MISSING_SUBJECT',
        message: 'Client certificate subject header missing',
        traceId: req.traceId,
      },
    });
    return;
  }

  const dn = parseDN(subject);
  const commonName = dn['CN'] ?? '';
  const organization = dn['O'];
  const organizationalUnit = dn['OU'];

  // CN allowlist check
  if (MTLS_ALLOWED_CNS && !MTLS_ALLOWED_CNS.includes(commonName)) {
    res.status(403).json({
      error: {
        code: 'MTLS_CN_NOT_ALLOWED',
        message: `Client certificate CN '${commonName}' is not in the allowlist`,
        traceId: req.traceId,
      },
    });
    return;
  }

  // Expiry check
  const notAfterHeader = req.headers['x-client-cert-notafter'];
  const notAfter = Array.isArray(notAfterHeader) ? notAfterHeader[0] : notAfterHeader;
  if (notAfter) {
    const expiry = new Date(notAfter).getTime();
    if (Date.now() > expiry) {
      res.status(401).json({
        error: {
          code: 'MTLS_CERT_EXPIRED',
          message: 'Client certificate has expired',
          validTo: notAfter,
          traceId: req.traceId,
        },
      });
      return;
    }
  }

  // Build identity and attach to request
  const serialHeader = req.headers['x-client-cert-serial'];
  const fingerprintHeader = req.headers['x-client-cert-fingerprint'];

  const identity: ClientCertIdentity = {
    commonName,
    serialNumber: (Array.isArray(serialHeader) ? serialHeader[0] : serialHeader) ?? '',
    validFrom: '',
    validTo: notAfter ?? '',
    fingerprint: (Array.isArray(fingerprintHeader) ? fingerprintHeader[0] : fingerprintHeader) ?? '',
    ...(organization !== undefined && { organization }),
    ...(organizationalUnit !== undefined && { organizationalUnit }),
  };

  req.clientCert = identity;
  next();
}
