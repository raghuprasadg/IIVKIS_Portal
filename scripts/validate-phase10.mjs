#!/usr/bin/env node
/**
 * IIVKIS Phase 10 Validation — UAT Environment
 *
 * Verifies that the UAT workspace is complete, self-consistent, and
 * configured to run independently from any development environment.
 * All checks are purely static (no Docker daemon required).
 *
 * Sections
 *   1. UAT workspace structure          (5 checks)
 *   2. Seed file JSON validity          (4 checks)
 *   3. Incidents data quality           (5 checks)
 *   4. Logs data quality                (4 checks)
 *   5. Signals data quality             (3 checks)
 *   6. Metrics data quality             (3 checks)
 *   7. Cross-referencing integrity      (4 checks)
 *   8. Connector config                 (7 checks)
 *   9. UAT environment independence     (4 checks)
 *                                      ──────────
 *                               Total: 39 checks
 *
 * Usage:
 *   node scripts/validate-phase10.mjs
 *   npm run validate:phase10
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const UAT        = join(ROOT, 'uat-workspace');
const SEED       = join(UAT, 'seed');
const CONNECTORS = join(UAT, 'connectors');
const INFRA      = join(ROOT, 'infra');

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

function loadJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// ─── 1. UAT workspace structure ─────────────────────────────────────────────
console.log('\n── 1. UAT workspace structure ──────────────────────────────────');

check('uat-workspace/ directory exists',         existsSync(UAT));
check('uat-workspace/seed/ directory exists',    existsSync(SEED));
check('uat-workspace/connectors/ directory exists', existsSync(CONNECTORS));
check('uat-workspace/README.md exists',          existsSync(join(UAT, 'README.md')));

const seedFiles = ['incidents.json', 'logs.json', 'metrics.json', 'signals.json'];
check(
  'all 4 seed files present',
  seedFiles.every(f => existsSync(join(SEED, f))),
  'missing: ' + seedFiles.filter(f => !existsSync(join(SEED, f))).join(', '),
);

// ─── 2. Seed file JSON validity ──────────────────────────────────────────────
console.log('\n── 2. Seed file JSON validity ───────────────────────────────────');

const incidents = loadJson(join(SEED, 'incidents.json'));
const logs      = loadJson(join(SEED, 'logs.json'));
const metrics   = loadJson(join(SEED, 'metrics.json'));
const signals   = loadJson(join(SEED, 'signals.json'));

check('incidents.json is valid JSON', incidents !== null);
check('logs.json is valid JSON',      logs      !== null);
check('metrics.json is valid JSON',   metrics   !== null);
check('signals.json is valid JSON',   signals   !== null);

// ─── 3. Incidents data quality ───────────────────────────────────────────────
console.log('\n── 3. Incidents data quality ────────────────────────────────────');

if (incidents !== null) {
  check(`incidents count ≥ 20`, incidents.length >= 20, `got ${incidents.length}`);

  const incRequiredFields = ['id', 'title', 'severity', 'status', 'tenantId', 'source'];
  const incFieldOk = incidents.every(i => incRequiredFields.every(f => f in i));
  check(
    'all incidents have required fields (id, title, severity, status, tenantId, source)',
    incFieldOk,
    'missing field(s) on one or more incidents',
  );

  check(
    'all incidents have tenantId="tenant-uat"',
    incidents.every(i => i.tenantId === 'tenant-uat'),
  );

  const severities = new Set(incidents.map(i => i.severity));
  check(
    'all 4 severity levels present (critical, high, medium, low)',
    ['critical', 'high', 'medium', 'low'].every(s => severities.has(s)),
    `found: ${[...severities].join(', ')}`,
  );

  check(
    'all incidents have sla block',
    incidents.every(i => typeof i.sla === 'object' && i.sla !== null),
  );
} else {
  for (let i = 0; i < 5; i++) fail('incidents data quality (skipped — invalid JSON)');
}

// ─── 4. Logs data quality ────────────────────────────────────────────────────
console.log('\n── 4. Logs data quality ─────────────────────────────────────────');

if (logs !== null) {
  check(`logs count ≥ 20`, logs.length >= 20, `got ${logs.length}`);

  const logRequiredFields = ['id', 'timestamp', 'level', 'service', 'message', 'tenantId'];
  const logFieldOk = logs.every(l => logRequiredFields.every(f => f in l));
  check(
    'all logs have required fields (id, timestamp, level, service, message, tenantId)',
    logFieldOk,
    'missing field(s) on one or more log entries',
  );

  check(
    'all logs have tenantId="tenant-uat"',
    logs.every(l => l.tenantId === 'tenant-uat'),
  );

  check(
    'logs contain ERROR level entries',
    logs.some(l => l.level === 'ERROR'),
  );
} else {
  for (let i = 0; i < 4; i++) fail('logs data quality (skipped — invalid JSON)');
}

// ─── 5. Signals data quality ─────────────────────────────────────────────────
console.log('\n── 5. Signals data quality ──────────────────────────────────────');

if (signals !== null) {
  check(`signals count ≥ 15`, signals.length >= 15, `got ${signals.length}`);

  const sigRequiredFields = ['signalType', 'severity', 'affectedCiId', 'title', 'occurredAt'];
  const sigFieldOk = signals.every(s => sigRequiredFields.every(f => f in s));
  check(
    'all signals have required fields (signalType, severity, affectedCiId, title, occurredAt)',
    sigFieldOk,
    'missing field(s) on one or more signals',
  );

  const signalTypes = new Set(signals.map(s => s.signalType));
  check(
    'signals contain ≥ 3 distinct signal types',
    signalTypes.size >= 3,
    `found ${signalTypes.size}: ${[...signalTypes].join(', ')}`,
  );
} else {
  for (let i = 0; i < 3; i++) fail('signals data quality (skipped — invalid JSON)');
}

// ─── 6. Metrics data quality ─────────────────────────────────────────────────
console.log('\n── 6. Metrics data quality ──────────────────────────────────────');

if (metrics !== null) {
  check(
    'metrics.json has meta and series fields',
    typeof metrics.meta === 'object' && Array.isArray(metrics.series),
  );

  check(
    'metrics has ≥ 5 time-series streams',
    Array.isArray(metrics.series) && metrics.series.length >= 5,
    `got ${Array.isArray(metrics.series) ? metrics.series.length : 0}`,
  );

  check(
    'every metrics series has at least 1 datapoint',
    Array.isArray(metrics.series) &&
      metrics.series.every(s => Array.isArray(s.datapoints) && s.datapoints.length >= 1),
  );
} else {
  for (let i = 0; i < 3; i++) fail('metrics data quality (skipped — invalid JSON)');
}

// ─── 7. Cross-referencing integrity ─────────────────────────────────────────
console.log('\n── 7. Cross-referencing integrity ───────────────────────────────');

if (incidents !== null && signals !== null && logs !== null) {
  // 7a. Multiple incidents share a correlationGroupId → cascade scenario is modelled
  const cgIds = incidents.map(i => i.correlationGroupId).filter(Boolean);
  const cgCounts = {};
  for (const id of cgIds) cgCounts[id] = (cgCounts[id] || 0) + 1;
  const sharedGroups = Object.values(cgCounts).filter(c => c >= 2).length;
  check(
    '≥ 2 incidents share a correlationGroupId (cascade scenario)',
    sharedGroups >= 1,
    `found ${sharedGroups} shared correlation group(s)`,
  );

  // 7b. Signals and incidents share at least one affectedCiId
  const incidentCis  = new Set(incidents.map(i => i.affectedCi).filter(Boolean));
  const signalCis    = new Set(signals.map(s => s.affectedCiId).filter(Boolean));
  const sharedCis    = [...signalCis].filter(ci => incidentCis.has(ci));
  check(
    'signals and incidents share ≥ 1 affectedCiId',
    sharedCis.length >= 1,
    `signal CIs: ${[...signalCis].slice(0,3).join(', ')} | incident CIs: ${[...incidentCis].slice(0,3).join(', ')}`,
  );

  // 7c. Logs reference at least one CI also found in incidents or signals
  const logHosts  = new Set(logs.map(l => l.host).filter(Boolean));
  const allCis    = new Set([...incidentCis, ...signalCis]);
  const sharedLogCis = [...logHosts].filter(h => allCis.has(h));
  check(
    'logs share ≥ 1 host with incident/signal CIs',
    sharedLogCis.length >= 1,
    `log hosts: ${[...logHosts].slice(0,3).join(', ')}`,
  );

  // 7d. Incident timestamps are valid ISO-8601 strings
  const tsOk = incidents.every(i => {
    const d = new Date(i.occurredAt);
    return !isNaN(d.getTime());
  });
  check('all incident timestamps are valid ISO-8601', tsOk);
} else {
  for (let i = 0; i < 4; i++) fail('cross-referencing (skipped — invalid seed JSON)');
}

// ─── 8. Connector config ─────────────────────────────────────────────────────
console.log('\n── 8. Connector config ──────────────────────────────────────────');

const connCfg = loadJson(join(CONNECTORS, 'config.json'));

if (connCfg !== null) {
  check(
    'connector config has tenantId="tenant-uat"',
    connCfg.tenantId === 'tenant-uat',
    `got "${connCfg.tenantId}"`,
  );

  const connectors = connCfg.connectors || [];
  check(`6 connectors defined`, connectors.length === 6, `got ${connectors.length}`);

  const connRequiredFields = ['id', 'name', 'type', 'vendor', 'enabled', 'mode'];
  check(
    'all connectors have required fields (id, name, type, vendor, enabled, mode)',
    connectors.every(c => connRequiredFields.every(f => f in c)),
  );

  check(
    'all connectors have mode="mock"',
    connectors.every(c => c.mode === 'mock'),
    'one or more connectors use non-mock mode',
  );

  // No real secrets — credentials must use __MOCK__ placeholder or be absent
  const credSecretFields = ['clientSecret', 'apiKey', 'password', 'token'];
  const hasLiveSecret = connectors.some(c => {
    const cred = c.credentials || {};
    return credSecretFields.some(f => {
      const v = cred[f];
      return typeof v === 'string' && v.length > 0 && v !== '__MOCK__';
    });
  });
  check('connector credentials use __MOCK__ placeholders (no live secrets)', !hasLiveSecret);

  const snw = connectors.find(c => c.vendor === 'ServiceNow');
  check('ServiceNow connector present and enabled', snw != null && snw.enabled === true);

  const pd = connectors.find(c => c.vendor === 'PagerDuty');
  check('PagerDuty connector present and enabled', pd != null && pd.enabled === true);
} else {
  for (let i = 0; i < 7; i++) fail('connector config (skipped — invalid JSON)');
}

// ─── 9. UAT environment independence ────────────────────────────────────────
console.log('\n── 9. UAT environment independence ──────────────────────────────');

const uatComposePath = join(INFRA, 'docker-compose.uat.yml');
check('infra/docker-compose.uat.yml exists', existsSync(uatComposePath));

let uatCompose = '';
if (existsSync(uatComposePath)) {
  uatCompose = readFileSync(uatComposePath, 'utf8');
}

check(
  'UAT compose declares a uat-seeder service',
  uatCompose.includes('uat-seeder:'),
);

check(
  'UAT compose uses UAT-specific database (iivkis_uat)',
  uatCompose.includes('iivkis_uat'),
);

check(
  'UAT compose uses distinct ports from dev stack (4010, 5010, 3010)',
  uatCompose.includes('4010:') && uatCompose.includes('5010:') && uatCompose.includes('3010:'),
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`Phase 10 validation: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
