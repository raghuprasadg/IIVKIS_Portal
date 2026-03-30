#!/usr/bin/env node
/**
 * IIVKIS Phase 11 Validation — Cloud + On-Prem Deployment
 *
 * Statically verifies that all deployment artifacts for Phase 11 exist,
 * are structurally complete, and satisfy the requirements:
 *   • Terraform cloud infra (AWS EKS, VPC, RDS, ElastiCache)
 *   • Helm chart for Kubernetes deployment (cloud + K3s)
 *   • K3s on-prem install script + manifests
 *   • Both deployment modes documented and functional
 *
 * Run:  node scripts/validate-phase11.mjs
 *       npm run validate:phase11
 *
 * Exit 0 = all checks PASS, exit 1 = one or more FAIL.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Helper ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('assertion returned false');
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${label}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function fileExists(rel) {
  return existsSync(path.join(ROOT, rel));
}

function fileContains(rel, ...terms) {
  const content = readFileSync(path.join(ROOT, rel), 'utf8');
  for (const term of terms) {
    if (!content.includes(term)) throw new Error(`"${term}" not found in ${rel}`);
  }
  return true;
}

function isExecutable(rel) {
  const stats = statSync(path.join(ROOT, rel));
  // owner execute bit (0o100)
  return (stats.mode & 0o100) !== 0;
}

// ─── Checks ──────────────────────────────────────────────────────────────────
console.log('\n━━━ IIVKIS Phase 11 Validation ━━━\n');

// ── Section 1: Terraform root module ─────────────────────────────────────────
console.log('1. Terraform root module');

check('infra/terraform/main.tf exists', () => fileExists('infra/terraform/main.tf'));
check('main.tf declares terraform required_version', () =>
  fileContains('infra/terraform/main.tf', 'required_version'));
check('main.tf declares AWS provider', () =>
  fileContains('infra/terraform/main.tf', 'hashicorp/aws'));
check('main.tf declares Helm provider', () =>
  fileContains('infra/terraform/main.tf', 'hashicorp/helm'));
check('main.tf uses S3 remote backend', () =>
  fileContains('infra/terraform/main.tf', 'backend "s3"'));
check('infra/terraform/variables.tf exists', () => fileExists('infra/terraform/variables.tf'));
check('variables.tf declares environment variable with validation', () =>
  fileContains('infra/terraform/variables.tf', 'environment', 'validation'));

// ── Section 2: Terraform VPC module ──────────────────────────────────────────
console.log('\n2. Terraform VPC module');

check('infra/terraform/modules/vpc/main.tf exists', () =>
  fileExists('infra/terraform/modules/vpc/main.tf'));
check('vpc module creates aws_vpc resource', () =>
  fileContains('infra/terraform/modules/vpc/main.tf', 'aws_vpc'));
check('vpc module creates public and private subnets', () =>
  fileContains('infra/terraform/modules/vpc/main.tf', 'aws_subnet', 'public', 'private'));
check('vpc module creates NAT gateways', () =>
  fileContains('infra/terraform/modules/vpc/main.tf', 'aws_nat_gateway'));
check('vpc subnets tagged for EKS', () =>
  fileContains('infra/terraform/modules/vpc/main.tf', 'kubernetes.io/role/elb'));

// ── Section 3: Terraform EKS module ──────────────────────────────────────────
console.log('\n3. Terraform EKS module');

check('infra/terraform/modules/eks/main.tf exists', () =>
  fileExists('infra/terraform/modules/eks/main.tf'));
check('eks module creates aws_eks_cluster', () =>
  fileContains('infra/terraform/modules/eks/main.tf', 'aws_eks_cluster'));
check('eks module creates managed node group', () =>
  fileContains('infra/terraform/modules/eks/main.tf', 'aws_eks_node_group'));
check('eks module enables OIDC provider for IRSA', () =>
  fileContains('infra/terraform/modules/eks/main.tf', 'aws_iam_openid_connect_provider'));
check('eks module enables control plane logging', () =>
  fileContains('infra/terraform/modules/eks/main.tf', 'enabled_cluster_log_types'));

// ── Section 4: Terraform RDS + ElastiCache modules ───────────────────────────
console.log('\n4. Terraform RDS + ElastiCache modules');

check('infra/terraform/modules/rds/main.tf exists', () =>
  fileExists('infra/terraform/modules/rds/main.tf'));
check('rds module uses PostgreSQL engine', () =>
  fileContains('infra/terraform/modules/rds/main.tf', '"postgres"'));
check('rds module enables storage encryption', () =>
  fileContains('infra/terraform/modules/rds/main.tf', 'storage_encrypted'));
check('infra/terraform/modules/elasticache/main.tf exists', () =>
  fileExists('infra/terraform/modules/elasticache/main.tf'));
check('elasticache module enables at-rest encryption', () =>
  fileContains('infra/terraform/modules/elasticache/main.tf', 'at_rest_encryption_enabled'));

// ── Section 5: Terraform environment tfvars ───────────────────────────────────
console.log('\n5. Terraform environment configurations');

check('infra/terraform/environments/prod.tfvars exists', () =>
  fileExists('infra/terraform/environments/prod.tfvars'));
check('prod.tfvars sets environment=prod', () =>
  fileContains('infra/terraform/environments/prod.tfvars', 'environment', 'prod'));
check('infra/terraform/environments/staging.tfvars exists', () =>
  fileExists('infra/terraform/environments/staging.tfvars'));
check('staging.tfvars sets environment=staging', () =>
  fileContains('infra/terraform/environments/staging.tfvars', 'environment', 'staging'));

// ── Section 6: Helm chart structure ──────────────────────────────────────────
console.log('\n6. Helm chart structure');

check('infra/helm/iivkis/Chart.yaml exists', () =>
  fileExists('infra/helm/iivkis/Chart.yaml'));
check('Chart.yaml declares correct chart name', () =>
  fileContains('infra/helm/iivkis/Chart.yaml', 'name: iivkis'));
check('Chart.yaml lists postgresql + redis dependencies', () =>
  fileContains('infra/helm/iivkis/Chart.yaml', 'postgresql', 'redis'));
check('infra/helm/iivkis/values.yaml exists', () =>
  fileExists('infra/helm/iivkis/values.yaml'));
check('values.yaml defines replicaCount for api/orchestrator/portal', () =>
  fileContains('infra/helm/iivkis/values.yaml', 'replicaCount', 'api:', 'orchestrator:', 'portal:'));

// ── Section 7: Helm templates ─────────────────────────────────────────────────
console.log('\n7. Helm templates');

check('infra/helm/iivkis/templates/_helpers.tpl exists', () =>
  fileExists('infra/helm/iivkis/templates/_helpers.tpl'));
check('_helpers.tpl defines iivkis.fullname', () =>
  fileContains('infra/helm/iivkis/templates/_helpers.tpl', 'iivkis.fullname'));
check('infra/helm/iivkis/templates/api.yaml exists', () =>
  fileExists('infra/helm/iivkis/templates/api.yaml'));
check('api.yaml is a Deployment with liveness + readiness probes', () =>
  fileContains('infra/helm/iivkis/templates/api.yaml',
    'kind: Deployment', 'livenessProbe', 'readinessProbe'));
check('infra/helm/iivkis/templates/orchestrator.yaml exists', () =>
  fileExists('infra/helm/iivkis/templates/orchestrator.yaml'));
check('infra/helm/iivkis/templates/portal.yaml exists', () =>
  fileExists('infra/helm/iivkis/templates/portal.yaml'));
check('infra/helm/iivkis/templates/ingress.yaml exists', () =>
  fileExists('infra/helm/iivkis/templates/ingress.yaml'));
check('ingress.yaml is conditional on .Values.ingress.enabled', () =>
  fileContains('infra/helm/iivkis/templates/ingress.yaml', 'ingress.enabled'));

// ── Section 8: Helm environment values files ──────────────────────────────────
console.log('\n8. Helm environment values files');

check('infra/helm/iivkis/values-k3s.yaml exists', () =>
  fileExists('infra/helm/iivkis/values-k3s.yaml'));
check('values-k3s.yaml uses local-path storage class', () =>
  fileContains('infra/helm/iivkis/values-k3s.yaml', 'local-path'));
check('values-k3s.yaml disables postgresql HA replica', () =>
  fileContains('infra/helm/iivkis/values-k3s.yaml', 'replicaCount: 0'));
check('infra/helm/iivkis/values-cloud.yaml exists', () =>
  fileExists('infra/helm/iivkis/values-cloud.yaml'));
check('values-cloud.yaml disables in-cluster postgresql (uses RDS)', () =>
  fileContains('infra/helm/iivkis/values-cloud.yaml', 'enabled: false'));
check('values-cloud.yaml enables ExternalSecrets', () =>
  fileContains('infra/helm/iivkis/values-cloud.yaml', 'externalSecrets'));

// ── Section 9: K3s on-prem artifacts ─────────────────────────────────────────
console.log('\n9. K3s on-prem deployment');

check('infra/k3s/install.sh exists', () => fileExists('infra/k3s/install.sh'));
check('install.sh installs K3s via official installer', () =>
  fileContains('infra/k3s/install.sh', 'get.k3s.io', 'INSTALL_K3S_VERSION'));
check('install.sh handles server mode', () =>
  fileContains('infra/k3s/install.sh', '"server"', '--disable traefik'));
check('install.sh handles agent mode', () =>
  fileContains('infra/k3s/install.sh', '"agent"', 'K3S_URL', 'K3S_TOKEN'));
check('install.sh installs ingress-nginx', () =>
  fileContains('infra/k3s/install.sh', 'ingress-nginx'));
check('install.sh deploys IIVKIS via helm upgrade --install', () =>
  fileContains('infra/k3s/install.sh', 'helm upgrade --install iivkis'));
check('infra/k3s/namespace.yaml exists', () => fileExists('infra/k3s/namespace.yaml'));
check('namespace.yaml creates iivkis namespace', () =>
  fileContains('infra/k3s/namespace.yaml', 'kind: Namespace', 'name: iivkis'));

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n━━━ Results: ${passed}/${total} checks passed ━━━\n`);

if (failed > 0) {
  console.error(`${failed} check(s) FAILED — Phase 11 validation INCOMPLETE\n`);
  process.exit(1);
} else {
  console.log('Phase 11 validation COMPLETE — all checks PASSED ✅\n');
  process.exit(0);
}
