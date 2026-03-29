#!/usr/bin/env node
/**
 * validate-phase6.mjs — Phase 6 Core Engine Integration Validation
 *
 * Runs a sample query through the full data-flow pipeline:
 *   raw events → normalization → KG enrichment → CE (16 processors) → groups with evidence
 *
 * Usage:  node scripts/validate-phase6.mjs
 *
 * Expected output: correlated groups, each with:
 *   - confidence score
 *   - correlation methods used
 *   - signal IDs forming the group
 *   - human-readable evidence narratives
 */

import { createHash, randomUUID } from 'node:crypto';

/* ── Inline minimal reproductions of the pipeline ───────────────────────── */
// We run directly against the built CommonJS modules rather than importing
// TypeScript sources, so we first build the packages that haven't been built.

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

function build(pkg) {
  try {
    execSync(`node "${TSC}" -p "${path.join(ROOT, pkg, 'tsconfig.json')}"`, {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch (e) {
    console.error(`Build failed for ${pkg}:\n${e.stderr?.toString() ?? e.message}`);
    process.exit(1);
  }
}

console.log('='.repeat(70));
console.log(' IIVKIS Phase 6 — Core Engine Integration Validation');
console.log('='.repeat(70));
console.log();

/* ── Build packages in dependency order ─────────────────────────────────── */
console.log('▶ Building workspace packages…');
build('packages/shared');
build('packages/agents/analysis');
build('packages/agents/integration');
build('packages/agents/vendor-knowledge');
build('packages/agents/troubleshooting');
build('apps/orchestrator');
console.log('  ✅ All packages built\n');

/* ── Dynamic imports of built packages ──────────────────────────────────── */
const { NormalizationEngine } = await import(
  path.join(ROOT, 'packages/agents/integration/dist/index.js')
);
const { IntegrationPipeline } = await import(
  path.join(ROOT, 'apps/orchestrator/dist/pipeline.js')
);

/* ── Sample raw events (simulating a mixed Zabbix + ServiceNow feed) ────── */

// Shared CI ID so the topology processor recognises topology siblings
const CI_DB_SERVER = 'ci-' + createHash('sha256').update('db-primary').digest('hex').slice(0, 12);
const CI_WEB_APP   = 'ci-' + createHash('sha256').update('web-app').digest('hex').slice(0, 12);

const now = new Date();
const t  = (offsetSeconds) => new Date(now - offsetSeconds * 1000).toISOString();

/** 7 raw events that should produce ≥1 correlated group */
const rawEvents = [
  // --- Zabbix: high CPU on DB server (3 alerts in quick succession) ---
  {
    zbx_trigger_id: 'ZBX-1001',
    host: CI_DB_SERVER,
    description: 'High CPU utilization on db-primary (95%)',
    priority: '4',          // High
    clock: Math.floor((now - 8 * 60_000) / 1000),
  },
  {
    zbx_trigger_id: 'ZBX-1002',
    host: CI_DB_SERVER,
    description: 'Database connection pool exhausted on db-primary',
    priority: '5',          // Disaster
    clock: Math.floor((now - 7 * 60_000) / 1000),
  },
  {
    zbx_trigger_id: 'ZBX-1003',
    host: CI_DB_SERVER,
    description: 'Slow query threshold exceeded on db-primary',
    priority: '3',          // Average
    clock: Math.floor((now - 6 * 60_000) / 1000),
  },
  // --- ServiceNow: incident logged manually for the same server ---
  {
    sys_id: 'INC0012345',
    short_description: 'Production DB degraded — users cannot log in',
    severity: '1',          // 1=Critical in ServiceNow
    configuration_item: CI_DB_SERVER,
    opened_at: t(5 * 60),
    source: 'servicenow',
  },
  // --- Zabbix: web app health check failing (downstream effect) ---
  {
    zbx_trigger_id: 'ZBX-2001',
    host: CI_WEB_APP,
    description: 'HTTP health check failing — web-app returning 503',
    priority: '4',
    clock: Math.floor((now - 4 * 60_000) / 1000),
  },
  // --- Out-of-window Zabbix noise signal (should NOT join above group) ---
  {
    zbx_trigger_id: 'ZBX-9001',
    host: CI_DB_SERVER,
    description: 'Disk utilization above 80% on db-primary',
    priority: '2',          // Warning
    clock: Math.floor((now - 35 * 60_000) / 1000), // 35 min ago — outside 10 min window
  },
  // --- Duplicate of ZBX-1001 (should be suppressed by dedup processor) ---
  {
    zbx_trigger_id: 'ZBX-1001',
    host: CI_DB_SERVER,
    description: 'High CPU utilization on db-primary (95%)',
    priority: '4',
    clock: Math.floor((now - 8 * 60_000) / 1000),
  },
];

/** Field mappings that convert Zabbix/ServiceNow raw fields to Signal */
const fieldMappings = [
  // Generic ID
  { sourceField: 'zbx_trigger_id', targetField: 'externalId' },
  { sourceField: 'sys_id',         targetField: 'externalId' },
  // Title
  { sourceField: 'description',    targetField: 'title' },
  { sourceField: 'short_description', targetField: 'title' },
  // Affected CI
  { sourceField: 'host',               targetField: 'affectedCiId' },
  { sourceField: 'configuration_item', targetField: 'affectedCiId' },
  // Source system
  { sourceField: 'source', targetField: 'sourceSystem' },
  // Severity (Zabbix priority 1-5 → SignalSeverity)
  {
    sourceField: 'priority',
    targetField: 'severity',
    transform: 'severity_map',
    severityMap: { '1': 'info', '2': 'low', '3': 'medium', '4': 'high', '5': 'critical' },
  },
  {
    sourceField: 'severity',
    targetField: 'severity',
    transform: 'severity_map',
    severityMap: { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low', '5': 'info' },
  },
];

/* ── Stage 1 demo: raw normalization ────────────────────────────────────── */
console.log('▶ Stage 1 — NormalizationEngine');
console.log(`  Input : ${rawEvents.length} raw events (Zabbix + ServiceNow)`);

const normEngine = new NormalizationEngine();
const { signals: normalizedSignals, trace: normTrace } = normEngine.normalize(rawEvents, {
  connectorType: 'zabbix',
  fieldMappings,
});

console.log(`  Output: ${normalizedSignals.length} canonical Signal objects`);
for (let i = 0; i < normalizedSignals.length; i++) {
  const s = normalizedSignals[i];
  const t = normTrace[i];
  console.log(
    `    [${i}] ${s.severity.padEnd(8)} | ci=${s.affectedCiId?.slice(0, 14) ?? '(none)'}… | "${s.title?.slice(0, 50)}"`
  );
  if (t?.fieldsDefaulted.length > 0) {
    console.log(`         defaulted: ${t.fieldsDefaulted.join(', ')}`);
  }
}
console.log();

/* ── Stage 2+3 demo: KG enrichment + CE via IntegrationPipeline ─────────── */
console.log('▶ Stage 2+3 — KG Enrichment + Correlation Engine (16 processors)');

const pipeline = new IntegrationPipeline();
const result = await pipeline.run({
  tenantId: 'tenant-' + randomUUID().slice(0, 8),
  userId:   'user-'   + randomUUID().slice(0, 8),
  rawEvents,
  integrationConfig: { connectorType: 'zabbix', fieldMappings },
});

console.log(`  Signals processed : ${result.normalizedSignals.length}`);
console.log(`  Groups produced   : ${result.correlatedGroups.length}`);
console.log(`  Signals suppressed: ${result.suppressedSignalIds.length}`);
console.log(`  Pipeline latency  : ${result.totalLatencyMs} ms`);
console.log();

/* ── Print processor log ─────────────────────────────────────────────────── */
const activeProcessors = result.processorLog.filter(
  p => p.groupsProposed > 0 || p.signalsSuppressed > 0,
);
if (activeProcessors.length > 0) {
  console.log('▶ Active Processors');
  for (const p of activeProcessors) {
    console.log(
      `  ${p.name.padEnd(28)} groups=${p.groupsProposed}  suppressed=${p.signalsSuppressed}`,
    );
  }
  console.log();
}

/* ── Print correlated groups with evidence ──────────────────────────────── */
if (result.correlatedGroups.length === 0) {
  console.error('❌ FAIL — No correlated groups produced. Expected ≥1.');
  process.exit(1);
}

console.log('▶ Correlated Groups with Evidence');
console.log('─'.repeat(70));

let passed = true;
for (let i = 0; i < result.correlatedGroups.length; i++) {
  const g = result.correlatedGroups[i];
  console.log(`\nGroup ${i + 1}  id=${g.id.slice(0, 18)}…`);
  console.log(`  Status     : ${g.status}`);
  console.log(`  Confidence : ${g.confidence.toFixed(1)} / 100`);
  console.log(`  Method(s)  : ${g.correlationMethods.join(', ')}`);
  console.log(`  Root CI    : ${g.rootCauseCiId ?? '(unknown)'}`);

  console.log(`  Signals (${g.signalIds.length}):`);
  for (const sig of (g.signals ?? [])) {
    console.log(
      `    • [${sig.severity}] "${sig.title?.slice(0, 60)}" @ ${sig.occurredAt}`,
    );
  }

  if (g.evidenceNarratives.length > 0) {
    console.log('  Evidence:');
    for (const n of g.evidenceNarratives) {
      console.log(`    ↳ ${n}`);
    }
  }

  if (g.signalIds.length < 2) {
    console.log('  ⚠  group has < 2 signals (may be a confidence-only adjustment)');
  }
}

console.log('\n' + '─'.repeat(70));

/* ── Final assertion ─────────────────────────────────────────────────────── */
const groupsWithEvidence = result.correlatedGroups.filter(
  g => g.signalIds.length >= 2 && g.evidenceNarratives.length > 0,
);

if (groupsWithEvidence.length === 0) {
  console.error('\n❌ FAIL — No groups with both signalIds (≥2) AND evidence narratives found.');
  passed = false;
} else {
  console.log(`\n✅ PASS — ${groupsWithEvidence.length} group(s) carry correlated signal evidence.`);
}

const highConfidence = result.correlatedGroups.filter(g => g.confidence >= 30);
if (highConfidence.length > 0) {
  console.log(`✅ PASS — ${highConfidence.length} group(s) have confidence ≥ 30.`);
} else {
  console.error('❌ FAIL — No groups with confidence ≥ 30.');
  passed = false;
}

console.log(`\nPhase 6 validation: ${passed ? '✅ PASS' : '❌ FAIL'}`);
process.exit(passed ? 0 : 1);
