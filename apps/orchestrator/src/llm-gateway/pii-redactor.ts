/**
 * PII redactor — scrubs sensitive data before audit logging (LLD §7.1 step 7).
 *
 * Supported patterns: email, US phone, SSN, credit card (Luhn-validated), IPv4, IPv6.
 */

interface RedactResult {
  redacted: string;
  found: string[];
}

/* ── patterns ─────────────────────────────────────────────────────────────── */

const PATTERNS: Array<{ label: string; re: RegExp }> = [
  {
    label: 'email',
    re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  {
    label: 'ssn',
    // 123-45-6789  or  123 45 6789
    re: /\b(?!000|666|9\d{2})\d{3}[-\s](?!00)\d{2}[-\s](?!0{4})\d{4}\b/g,
  },
  {
    label: 'phone',
    // (123) 456-7890 | 123-456-7890 | +1 123 456 7890 | 1234567890
    re: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  },
  {
    label: 'ipv6',
    re: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?::[0-9a-fA-F]{1,4}){1,7}/g,
  },
  {
    label: 'ipv4',
    re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
];

/* Credit card numbers require Luhn validation, so we handle them separately. */
const CC_RE = /\b(?:\d[ \-]?){13,16}\b/g;

/* ── Luhn check ───────────────────────────────────────────────────────────── */

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i] ?? '0', 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/* ── public API ───────────────────────────────────────────────────────────── */

export function redact(text: string): RedactResult {
  const found: string[] = [];
  let result = text;

  // Credit cards (Luhn-validated)
  result = result.replace(CC_RE, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 16 && luhn(digits)) {
      found.push('credit-card');
      return '[REDACTED-credit-card]';
    }
    return match;
  });

  for (const { label, re } of PATTERNS) {
    // Reset lastIndex for global regexes
    re.lastIndex = 0;
    result = result.replace(re, (match) => {
      found.push(label);
      return `[REDACTED-${label}]`;
    });
  }

  return { redacted: result, found };
}

export function containsPii(text: string): boolean {
  for (const { re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) return true;
  }

  CC_RE.lastIndex = 0;
  for (const match of text.matchAll(CC_RE)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 16 && luhn(digits)) return true;
  }

  return false;
}
