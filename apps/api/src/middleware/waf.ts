/**
 * WAF (Web Application Firewall) middleware (Phase 7 — Security).
 *
 * Inspects every inbound request for common attack patterns and rejects
 * malicious requests with HTTP 400 before they reach route handlers.
 *
 * Rules enforced:
 *  1. Payload size limit (default 1 MB)
 *  2. SQL injection patterns in URL params, query strings, and JSON body
 *  3. XSS / script-injection patterns
 *  4. Path traversal sequences
 *  5. OS command injection sequences
 *  6. LLM prompt-injection phrases (AI-specific guardrail)
 *  7. Suspicious header values (oversized or containing CRLF)
 *
 * All violations are logged with a sanitised snippet (no full payload in logs)
 * and returned as structured errors with a `wafViolation` field.
 *
 * Performance: all pattern matching is done with pre-compiled RegExp instances.
 */

import { type Request, type Response, type NextFunction } from 'express';
import type { WAFViolation, WAFThreatCategory } from '@iivkis/shared';

/* ── configuration ───────────────────────────────────────────────────────── */

const MAX_BODY_BYTES = Number(process.env['WAF_MAX_BODY_BYTES'] ?? 1_048_576); // 1 MB

/* ── compiled patterns ───────────────────────────────────────────────────── */

const PATTERNS: Array<{
  category: WAFThreatCategory;
  re: RegExp;
  description: string;
}> = [
  // SQL injection
  {
    category: 'sql_injection',
    re: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|EXEC|UNION|CAST|CONVERT)\b.*\bFROM\b|\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?|;\s*--|\bxp_\w+)/i,
    description: 'SQL injection pattern detected',
  },
  // XSS
  {
    category: 'xss',
    re: /<script[\s>]|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*svg[\s>]/i,
    description: 'XSS pattern detected',
  },
  // Path traversal
  {
    category: 'path_traversal',
    re: /(\.\.(\/|\\)){2,}|%2e%2e(\/|%2f|%5c)/i,
    description: 'Path traversal pattern detected',
  },
  // Command injection
  {
    category: 'command_injection',
    re: /[;&|`$]\s*(ls|cat|rm|wget|curl|nc|bash|sh|python|perl|ruby|php)\b|`[^`]*`|\$\([^)]*\)/,
    description: 'Command injection pattern detected',
  },
  // LLM prompt injection
  {
    category: 'llm_prompt_injection',
    re: /ignore (all )?previous instructions|disregard (your|all) (prior |previous )?instructions|you are now (a|an) |jailbreak|act as (if you are|a) /i,
    description: 'LLM prompt injection attempt detected',
  },
];

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Truncate a string to max N chars for safe logging. */
function snippet(value: string, max = 80): string {
  const s = value.replace(/[\r\n]+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function scanValue(
  value: string,
  field: string,
): WAFViolation | null {
  for (const { category, re, description: _ } of PATTERNS) {
    if (re.test(value)) {
      return { category, field, snippet: snippet(value) };
    }
  }
  return null;
}

function flattenObject(
  obj: unknown,
  prefix = '',
  results: Record<string, string> = {},
): Record<string, string> {
  if (typeof obj === 'string') {
    results[prefix || 'body'] = obj;
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flattenObject(v, `${prefix}[${i}]`, results));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flattenObject(v, prefix ? `${prefix}.${k}` : k, results);
    }
  }
  return results;
}

/* ── middleware ──────────────────────────────────────────────────────────── */

export function wafMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Payload size check (headers-based, exact check by express json limit)
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    const violation: WAFViolation = {
      category: 'oversized_payload',
      field: 'Content-Length',
      snippet: String(contentLength),
    };
    rejectRequest(res, req, violation);
    return;
  }

  // 2. Suspicious header check (CRLF injection, oversized values)
  for (const [headerName, headerValue] of Object.entries(req.headers)) {
    const value = Array.isArray(headerValue) ? headerValue.join(', ') : headerValue ?? '';
    if (value.length > 8192) {
      const violation: WAFViolation = {
        category: 'suspicious_header',
        field: `header:${headerName}`,
        snippet: snippet(value),
      };
      rejectRequest(res, req, violation);
      return;
    }
    if (/\r|\n/.test(value)) {
      const violation: WAFViolation = {
        category: 'suspicious_header',
        field: `header:${headerName}`,
        snippet: 'CRLF sequence in header value',
      };
      rejectRequest(res, req, violation);
      return;
    }
  }

  // 3. URL path and query string scan
  const urlToScan = req.originalUrl;
  const urlViolation = scanValue(urlToScan, 'url');
  if (urlViolation) {
    rejectRequest(res, req, urlViolation);
    return;
  }

  // 4. Request body scan (already parsed by express.json())
  if (req.body !== undefined && req.body !== null) {
    const fields = flattenObject(req.body);
    for (const [field, value] of Object.entries(fields)) {
      const violation = scanValue(value, `body.${field}`);
      if (violation) {
        rejectRequest(res, req, violation);
        return;
      }
    }
  }

  next();
}

function rejectRequest(res: Response, req: Request, violation: WAFViolation): void {
  console.warn(
    `[waf] ${violation.category} in ${violation.field} — ` +
      `ip=${req.ip ?? 'unknown'} path=${req.path}`,
  );
  res.status(400).json({
    error: {
      code: 'WAF_VIOLATION',
      message: `Request blocked by WAF: ${violation.category}`,
      wafViolation: violation,
      traceId: (req as Request & { traceId?: string }).traceId,
    },
  });
}
