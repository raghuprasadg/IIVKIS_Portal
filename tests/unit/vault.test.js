'use strict';
/**
 * Unit tests — Vault secrets provider
 * Source: apps/api/src/security/vault.ts
 * Compiled: apps/api/dist/security/vault.js
 */

const path = require('path');
const vaultModule = require(
  path.resolve(__dirname, '../../apps/api/dist/security/vault'),
);
const { getSecret, clearSecretCache, secretFingerprint, resolveAllSecrets } = vaultModule;

beforeEach(() => {
  clearSecretCache();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // Ensure no VAULT_ADDR so we stay in env-fallback mode
  delete process.env['VAULT_ADDR'];
});
afterEach(() => {
  jest.restoreAllMocks();
  clearSecretCache();
});

/* ── env-var fallback mode ────────────────────────────────────────────────── */

describe('getSecret() — env-var fallback mode', () => {
  it('resolves value from the specified env var', async () => {
    process.env['TEST_SECRET_VAULT'] = 'my-test-secret-value';
    const value = await getSecret('test-secret', 'iivkis/test', 'key', 'TEST_SECRET_VAULT');
    expect(value).toBe('my-test-secret-value');
    delete process.env['TEST_SECRET_VAULT'];
  });

  it('returns empty string and warns when env var is not set', async () => {
    delete process.env['MISSING_SECRET_XYZ'];
    const warnSpy = jest.spyOn(console, 'warn');
    const value = await getSecret('missing', 'iivkis/test', 'key', 'MISSING_SECRET_XYZ');
    expect(value).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('MISSING_SECRET_XYZ'));
  });

  it('caches the resolved value on subsequent calls', async () => {
    process.env['CACHED_SECRET_ABC'] = 'cached-value';
    const first = await getSecret('cached-test', 'iivkis/test', 'key', 'CACHED_SECRET_ABC');
    // Change the env var — cached value should still be returned
    process.env['CACHED_SECRET_ABC'] = 'changed-value';
    const second = await getSecret('cached-test', 'iivkis/test', 'key', 'CACHED_SECRET_ABC');
    expect(first).toBe('cached-value');
    expect(second).toBe('cached-value'); // cache hit
    delete process.env['CACHED_SECRET_ABC'];
  });

  it('re-reads after cache is cleared', async () => {
    process.env['CLEAR_TEST_SECRET'] = 'original';
    await getSecret('clear-test', 'iivkis/test', 'key', 'CLEAR_TEST_SECRET');
    clearSecretCache();
    process.env['CLEAR_TEST_SECRET'] = 'updated';
    const value = await getSecret('clear-test', 'iivkis/test', 'key', 'CLEAR_TEST_SECRET');
    expect(value).toBe('updated');
    delete process.env['CLEAR_TEST_SECRET'];
  });
});

/* ── secretFingerprint() ──────────────────────────────────────────────────── */

describe('secretFingerprint()', () => {
  it('returns a 16-character hex string', () => {
    const fp = secretFingerprint('my-secret-value');
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — same input → same output', () => {
    const a = secretFingerprint('deterministic');
    const b = secretFingerprint('deterministic');
    expect(a).toBe(b);
  });

  it('is different for different secrets', () => {
    const a = secretFingerprint('secret-A');
    const b = secretFingerprint('secret-B');
    expect(a).not.toBe(b);
  });

  it('handles empty string input', () => {
    const fp = secretFingerprint('');
    expect(fp).toHaveLength(16);
  });
});

/* ── resolveAllSecrets() ──────────────────────────────────────────────────── */

describe('resolveAllSecrets()', () => {
  it('returns an object with all four secret keys', async () => {
    const secrets = await resolveAllSecrets();
    expect(secrets).toHaveProperty('jwtSecret');
    expect(secrets).toHaveProperty('dbPassword');
    expect(secrets).toHaveProperty('llmApiKey');
    expect(secrets).toHaveProperty('redisPassword');
  });

  it('returns empty strings when no env vars are set (graceful fallback)', async () => {
    // Clear any accidentally set env vars
    delete process.env['JWT_SECRET'];
    delete process.env['DB_PASSWORD'];
    delete process.env['LLM_API_KEY'];
    delete process.env['REDIS_PASSWORD'];
    const secrets = await resolveAllSecrets();
    // All should be strings (empty or whatever is configured)
    expect(typeof secrets.jwtSecret).toBe('string');
    expect(typeof secrets.dbPassword).toBe('string');
    expect(typeof secrets.llmApiKey).toBe('string');
    expect(typeof secrets.redisPassword).toBe('string');
  });

  it('picks up JWT_SECRET from env var', async () => {
    process.env['JWT_SECRET'] = 'test-jwt-secret-value';
    const secrets = await resolveAllSecrets();
    expect(secrets.jwtSecret).toBe('test-jwt-secret-value');
    delete process.env['JWT_SECRET'];
  });
});
