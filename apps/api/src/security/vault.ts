/**
 * Vault secrets provider (Phase 7 — Security).
 *
 * Retrieves secrets from HashiCorp Vault KV-v2 when VAULT_ADDR is set.
 * Falls back to environment variables when Vault is unavailable (dev / CI).
 *
 * The provider is designed for:
 *  1. DB credentials   — DATABASE_URL / DB_* env vars
 *  2. JWT signing keys — JWT_SECRET / JWT_PUBLIC_KEY env vars
 *  3. LLM API keys     — LLM_API_KEY env var
 *  4. Webhook secrets  — per-integration secrets stored under vault path
 *
 * All values are cached in-process for CACHE_TTL_MS to avoid hammering Vault.
 * Cache entries are evicted lazily on the next read after expiry.
 *
 * In production the service account token is read from
 * /var/run/secrets/kubernetes.io/serviceaccount/token (Kubernetes Vault agent).
 */

import { createHash } from 'crypto';

const VAULT_ADDR = process.env['VAULT_ADDR'];
const VAULT_TOKEN = process.env['VAULT_TOKEN'];
const VAULT_NAMESPACE = process.env['VAULT_NAMESPACE'] ?? '';
const VAULT_KV_MOUNT = process.env['VAULT_KV_MOUNT'] ?? 'secret';
const CACHE_TTL_MS = Number(process.env['VAULT_CACHE_TTL_MS'] ?? 300_000); // 5 min

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const secretCache = new Map<string, CacheEntry>();

const MODE: 'vault' | 'env' = VAULT_ADDR ? 'vault' : 'env';

/* ── public API ──────────────────────────────────────────────────────────── */

/**
 * Resolve a named secret.
 *
 * @param name     Logical secret name (e.g. 'jwt_secret', 'db_password').
 * @param vaultPath Vault KV path (e.g. 'iivkis/api'). Only used in vault mode.
 * @param vaultKey  Key within the KV map (e.g. 'jwt_secret').
 * @param envVar   Env var fallback name.
 */
export async function getSecret(
  name: string,
  vaultPath: string,
  vaultKey: string,
  envVar: string,
): Promise<string> {
  // 1. Check cache
  const cached = secretCache.get(name);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  let value: string | undefined;

  if (MODE === 'vault') {
    value = await fetchFromVault(vaultPath, vaultKey);
  }

  // Fall back to env var (also the primary source in dev/CI)
  if (value === undefined || value === '') {
    value = process.env[envVar];
  }

  if (value === undefined) {
    console.warn(
      `[vault] Secret '${name}' not found in Vault or env var ${envVar}. ` +
        'Using empty string — ensure secret is configured in production.',
    );
    value = '';
  }

  // Cache the resolved value
  secretCache.set(name, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Resolve all IIVKIS platform secrets in one batch.
 * Returns a strongly-typed map for easy destructuring.
 */
export async function resolveAllSecrets(): Promise<{
  jwtSecret: string;
  dbPassword: string;
  llmApiKey: string;
  redisPassword: string;
}> {
  const [jwtSecret, dbPassword, llmApiKey, redisPassword] = await Promise.all([
    getSecret('jwt_secret', 'iivkis/api', 'jwt_secret', 'JWT_SECRET'),
    getSecret('db_password', 'iivkis/db', 'password', 'DB_PASSWORD'),
    getSecret('llm_api_key', 'iivkis/llm', 'api_key', 'LLM_API_KEY'),
    getSecret('redis_password', 'iivkis/redis', 'password', 'REDIS_PASSWORD'),
  ]);
  return { jwtSecret, dbPassword, llmApiKey, redisPassword };
}

/** Evict all cached secrets (useful for testing or key rotation). */
export function clearSecretCache(): void {
  secretCache.clear();
}

/** Returns a redacted fingerprint of a secret for audit logging. */
export function secretFingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

/* ── private helpers ─────────────────────────────────────────────────────── */

async function fetchFromVault(path: string, key: string): Promise<string | undefined> {
  if (!VAULT_ADDR) return undefined;

  const token = VAULT_TOKEN ?? (await readK8sServiceAccountToken());
  if (!token) {
    console.warn('[vault] No VAULT_TOKEN and Kubernetes token unavailable');
    return undefined;
  }

  const url = `${VAULT_ADDR}/v1/${VAULT_KV_MOUNT}/data/${path}`;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Vault-Token': token,
        ...(VAULT_NAMESPACE ? { 'X-Vault-Namespace': VAULT_NAMESPACE } : {}),
      },
    });

    if (!resp.ok) {
      console.warn(`[vault] Failed to fetch ${path}: HTTP ${resp.status}`);
      return undefined;
    }

    const body = (await resp.json()) as {
      data?: { data?: Record<string, string> };
    };
    return body?.data?.data?.[key];
  } catch (err) {
    console.warn(`[vault] Network error fetching ${path}: ${String(err)}`);
    return undefined;
  }
}

async function readK8sServiceAccountToken(): Promise<string | undefined> {
  const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
  try {
    const fs = await import('node:fs/promises');
    return (await fs.readFile(tokenPath, 'utf8')).trim();
  } catch {
    return undefined;
  }
}
