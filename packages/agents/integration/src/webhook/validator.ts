import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Validate an HMAC signature on a raw request body.
 *
 * Compares the supplied signature against a freshly computed digest using
 * timing-safe comparison to prevent timing attacks.
 *
 * @param rawBody   - The raw request body string.
 * @param signature - The signature value to verify (hex-encoded digest only,
 *                    or a "sha256=<hex>" / "sha1=<hex>" prefixed value).
 * @param secret    - The shared secret used to compute the HMAC.
 * @param algo      - Hash algorithm; defaults to 'sha256'.
 */
export function validateHmacSignature(
  rawBody: string,
  signature: string,
  secret: string,
  algo: 'sha256' | 'sha1' = 'sha256',
): boolean {
  try {
    // Strip optional "<algo>=" prefix (GitHub/PagerDuty style).
    const prefix = `${algo}=`;
    const cleanSig = signature.startsWith(prefix)
      ? signature.slice(prefix.length)
      : signature;

    const expected = createHmac(algo, secret).update(rawBody, 'utf8').digest('hex');

    // Both buffers must be the same length for timingSafeEqual.
    if (cleanSig.length !== expected.length) return false;

    return timingSafeEqual(Buffer.from(cleanSig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
