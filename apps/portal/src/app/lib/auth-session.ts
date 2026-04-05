import type { DemoUser } from './demo-users';

export const PORTAL_SESSION_COOKIE = 'iivkis_portal_session';

const SESSION_VERSION = 1;
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface PortalSessionPayload {
  version: number;
  username: string;
  role: DemoUser['role'];
  mode: DemoUser['mode'];
  displayName: string;
  org: string;
  userId: string;
  tenantId: string;
  iat: number;
  exp: number;
}

function getSessionSecret(): string {
  return process.env['PORTAL_SESSION_SECRET']?.trim() || 'iivkis-dev-session-secret-change-me';
}

function toBinaryString(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(toBinaryString(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function buildSessionPayload(user: DemoUser): PortalSessionPayload {
  const now = Math.floor(Date.now() / 1000);

  return {
    version: SESSION_VERSION,
    username: user.username,
    role: user.role,
    mode: user.mode,
    displayName: user.displayName,
    org: user.org,
    userId: user.userId,
    tenantId: user.tenantId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
}

export async function createPortalSessionToken(user: DemoUser): Promise<string> {
  const payload = buildSessionPayload(user);
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(encodedPayload));
  const encodedSignature = encodeBase64Url(new Uint8Array(signature));

  return `${encodedPayload}.${encodedSignature}`;
}

export async function verifyPortalSessionToken(token: string | null | undefined): Promise<DemoUser | null> {
  if (!token) return null;

  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) return null;

  const valid = await crypto.subtle.verify(
    'HMAC',
    await getSigningKey(),
    decodeBase64Url(encodedSignature),
    encoder.encode(encodedPayload),
  ).catch(() => false);

  if (!valid) return null;

  try {
    const payload = JSON.parse(decoder.decode(decodeBase64Url(encodedPayload))) as PortalSessionPayload;
    if (payload.version !== SESSION_VERSION) return null;
    if (payload.exp * 1000 <= Date.now()) return null;

    return {
      username: payload.username,
      role: payload.role,
      mode: payload.mode,
      displayName: payload.displayName,
      org: payload.org,
      userId: payload.userId,
      tenantId: payload.tenantId,
    };
  } catch {
    return null;
  }
}

export function getPortalSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function getPortalSessionFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(/;\s*/)) {
    const [name, ...rest] = part.split('=');
    if (name === PORTAL_SESSION_COOKIE) {
      return rest.join('=') || null;
    }
  }

  return null;
}
