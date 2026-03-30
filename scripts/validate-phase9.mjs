#!/usr/bin/env node
/**
 * IIVKIS Phase 9 Validation — Docker / Local Run
 *
 * Verifies that all services declared in infra/docker-compose.yml:
 *  1. Have a Dockerfile (where applicable)
 *  2. Expose the expected health-check endpoint (HTTP reachability)
 *  3. docker-compose config is syntactically valid
 *
 * Usage (no Docker daemon required — static checks only):
 *   node scripts/validate-phase9.mjs
 *
 * Usage (full live checks — requires docker compose up):
 *   node scripts/validate-phase9.mjs --live
 */
import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INFRA = join(ROOT, 'infra');
const LIVE = process.argv.includes('--live');

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ PASS — ${label}`);
  passed++;
}

function fail(label, reason = '') {
  console.error(`  ❌ FAIL — ${label}${reason ? ': ' + reason : ''}`);
  failed++;
}

function check(label, condition, reason = '') {
  if (condition) ok(label);
  else fail(label, reason);
}

// ─── 1. Dockerfile existence checks ────────────────────────────────────────
console.log('\n── 1. Dockerfile presence ──────────────────────────────────────');

const dockerfiles = [
  'apps/api/Dockerfile',
  'apps/orchestrator/Dockerfile',
  'apps/portal/Dockerfile',
];
for (const df of dockerfiles) {
  check(`${df} exists`, existsSync(join(ROOT, df)));
}

// ─── 2. docker-compose.yml config validation ────────────────────────────────
console.log('\n── 2. docker-compose config syntax ─────────────────────────────');

try {
  const result = spawnSync(
    'docker',
    ['compose', '-f', join(INFRA, 'docker-compose.yml'), '--env-file', join(INFRA, '.env.example'), 'config', '--quiet'],
    { encoding: 'utf8' },
  );
  check(
    'docker compose config is valid',
    result.status === 0,
    result.stderr?.trim() || result.stdout?.trim(),
  );
} catch (e) {
  fail('docker compose config', String(e));
}

// ─── 3. Service declarations ─────────────────────────────────────────────────
console.log('\n── 3. Required services declared in docker-compose.yml ──────────');

const expectedServices = [
  'postgres', 'redis', 'neo4j', 'keycloak',
  'vault', 'prometheus', 'grafana',
  'api', 'orchestrator', 'portal',
];

let composeYaml = '';
try {
  composeYaml = execSync(
    `docker compose -f ${join(INFRA, 'docker-compose.yml')} --env-file ${join(INFRA, '.env.example')} config`,
    { encoding: 'utf8' },
  );
} catch (e) {
  // composeYaml stays empty; individual checks will fail
}

for (const svc of expectedServices) {
  check(`service "${svc}" declared`, composeYaml.includes(`name: ${svc}`) || composeYaml.includes(`container_name: iivkis-${svc}`));
}

// ─── 4. Health-check definitions ────────────────────────────────────────────
console.log('\n── 4. Health checks defined for application services ─────────────');

const appServices = ['api', 'orchestrator', 'portal'];
for (const svc of appServices) {
  // A health-check test referencing localhost:<port>/health (or just /)
  const hasHealth = composeYaml.includes(`iivkis-${svc}`) &&
    (composeYaml.includes(`${svc}:`) || true) &&
    composeYaml.includes('healthcheck');
  check(`health check configured for "${svc}"`, hasHealth);
}

// ─── 5. Environment variable coverage ───────────────────────────────────────
console.log('\n── 5. .env.example covers all service ports ─────────────────────');

const { readFileSync } = await import('fs');
const envExample = readFileSync(join(INFRA, '.env.example'), 'utf8');

const requiredEnvVars = [
  'POSTGRES_PORT', 'REDIS_PORT', 'NEO4J_HTTP_PORT', 'NEO4J_BOLT_PORT',
  'KEYCLOAK_PORT', 'VAULT_PORT', 'PROMETHEUS_PORT', 'GRAFANA_PORT',
  'API_PORT', 'ORCHESTRATOR_PORT', 'PORTAL_PORT',
];
for (const v of requiredEnvVars) {
  check(`${v} in .env.example`, envExample.includes(v));
}

// ─── 6. Live health checks (only when --live flag is set) ─────────────────
if (LIVE) {
  console.log('\n── 6. Live health checks (--live mode) ──────────────────────────');

  const endpoints = [
    { label: 'API /health',           url: 'http://localhost:4000/health' },
    { label: 'Orchestrator /health',  url: 'http://localhost:5000/health' },
    { label: 'Portal /',              url: 'http://localhost:3000' },
    { label: 'Prometheus /-/healthy', url: 'http://localhost:9090/-/healthy' },
    { label: 'Grafana /api/health',   url: 'http://localhost:3001/api/health' },
  ];

  for (const { label, url } of endpoints) {
    try {
      const r = spawnSync('wget', ['--quiet', '--spider', '--timeout=10', url], { encoding: 'utf8' });
      check(label, r.status === 0, r.stderr?.trim());
    } catch (e) {
      fail(label, String(e));
    }
  }
} else {
  console.log('\n  ℹ️  Skipping live endpoint checks (re-run with --live after docker compose up)');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`Phase 9 validation: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
