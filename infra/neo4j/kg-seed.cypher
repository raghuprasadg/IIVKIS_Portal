// IIVKIS Knowledge Graph — Seed Data (Development / Demo)
// Run after kg-schema.cypher to populate a local Neo4j instance with sample data.
// Safe to re-run (uses MERGE).

// ── Vendors ───────────────────────────────────────────────────────────────────

MERGE (cisco:Vendor { id: 'vendor-cisco', name: 'Cisco', website: 'https://cisco.com', createdAt: '2024-01-01T00:00:00Z' });
MERGE (vmware:Vendor { id: 'vendor-vmware', name: 'VMware', website: 'https://vmware.com', createdAt: '2024-01-01T00:00:00Z' });
MERGE (redhat:Vendor { id: 'vendor-redhat', name: 'Red Hat', website: 'https://redhat.com', createdAt: '2024-01-01T00:00:00Z' });
MERGE (microsoft:Vendor { id: 'vendor-microsoft', name: 'Microsoft', website: 'https://microsoft.com', createdAt: '2024-01-01T00:00:00Z' });
MERGE (postgresql:Vendor { id: 'vendor-postgresql', name: 'PostgreSQL Global Development Group', website: 'https://postgresql.org', createdAt: '2024-01-01T00:00:00Z' });

// ── Products ──────────────────────────────────────────────────────────────────

MERGE (ios_xe:Product { id: 'prod-cisco-ios-xe', vendorId: 'vendor-cisco', name: 'IOS XE', category: 'network-os' });
MERGE (vcenter:Product { id: 'prod-vmware-vcenter', vendorId: 'vendor-vmware', name: 'vCenter Server', category: 'virtualization' });
MERGE (rhel:Product { id: 'prod-redhat-rhel', vendorId: 'vendor-redhat', name: 'Red Hat Enterprise Linux', category: 'operating-system' });
MERGE (pg16:Product { id: 'prod-pg16', vendorId: 'vendor-postgresql', name: 'PostgreSQL 16', category: 'database' });
MERGE (ad:Product { id: 'prod-microsoft-ad', vendorId: 'vendor-microsoft', name: 'Active Directory', category: 'identity' });

// Product → Vendor edges
MERGE (cisco)-[:HAS_PRODUCT]->(ios_xe);
MERGE (vmware)-[:HAS_PRODUCT]->(vcenter);
MERGE (redhat)-[:HAS_PRODUCT]->(rhel);
MERGE (postgresql)-[:HAS_PRODUCT]->(pg16);
MERGE (microsoft)-[:HAS_PRODUCT]->(ad);

// ── Versions ──────────────────────────────────────────────────────────────────

MERGE (ios17_9:Version { id: 'ver-ios-17.9', productId: 'prod-cisco-ios-xe', semver: '17.9.5', releaseDate: '2024-02-01' });
MERGE (vcenter8:Version { id: 'ver-vcenter-8.0', productId: 'prod-vmware-vcenter', semver: '8.0.2', releaseDate: '2024-03-01' });
MERGE (rhel9_3:Version { id: 'ver-rhel-9.3', productId: 'prod-redhat-rhel', semver: '9.3', releaseDate: '2023-11-07' });
MERGE (pg16_2:Version { id: 'ver-pg-16.2', productId: 'prod-pg16', semver: '16.2', releaseDate: '2024-02-08' });

MERGE (ios_xe)-[:HAS_VERSION]->(ios17_9);
MERGE (vcenter)-[:HAS_VERSION]->(vcenter8);
MERGE (rhel)-[:HAS_VERSION]->(rhel9_3);
MERGE (pg16)-[:HAS_VERSION]->(pg16_2);

// ── Advisories ────────────────────────────────────────────────────────────────

MERGE (adv1:Advisory {
  id: 'adv-cisco-cve-2024-20399',
  title: 'Cisco IOS XE Privilege Escalation Vulnerability',
  description: 'A vulnerability in the web UI of Cisco IOS XE Software could allow a remote, unauthenticated attacker to gain elevated privileges.',
  severity: 'critical',
  cveId: 'CVE-2024-20399',
  cvssScore: 9.8,
  publishedAt: '2024-03-15T00:00:00Z',
  updatedAt: '2024-03-20T00:00:00Z',
  affectedVersions: ['< 17.9.4a'],
  fixedInVersion: '17.9.4a',
  workaround: 'Disable HTTP Server feature',
  sourceUrl: 'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-20240315-iosxe'
});

MERGE (adv2:Advisory {
  id: 'adv-pg-cve-2024-0985',
  title: 'PostgreSQL non-owner REFRESH MATERIALIZED VIEW CONCURRENTLY execution privilege escalation',
  description: 'Late privilege drop in REFRESH MATERIALIZED VIEW CONCURRENTLY in PostgreSQL allows an object creator to execute arbitrary SQL functions as the command issuer.',
  severity: 'high',
  cveId: 'CVE-2024-0985',
  cvssScore: 8.0,
  publishedAt: '2024-02-08T00:00:00Z',
  updatedAt: '2024-02-08T00:00:00Z',
  affectedVersions: ['< 16.2', '< 15.6', '< 14.11'],
  fixedInVersion: '16.2',
  workaround: 'Revoke CREATE privileges from untrusted users',
  sourceUrl: 'https://www.postgresql.org/support/security/CVE-2024-0985/'
});

MERGE (adv1)-[:AFFECTS]->(ios_xe);
MERGE (adv2)-[:AFFECTS]->(pg16);
MERGE (adv1)-[:AFFECTS_VERSION]->(ios17_9);

// ── Demo CI infrastructure (tenant: demo-tenant-001) ─────────────────────────

MERGE (dc1:CI { id: 'ci-dc-prod-01', tenantId: 'demo-tenant-001', name: 'prod-datacenter-01', ciType: 'datacenter', environment: 'production', status: 'operational', tags: ['production', 'primary'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (cluster1:CI { id: 'ci-cluster-prod-01', tenantId: 'demo-tenant-001', name: 'prod-k8s-cluster-01', ciType: 'cluster', environment: 'production', status: 'operational', tags: ['kubernetes', 'production'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (db_primary:CI { id: 'ci-db-pg-primary', tenantId: 'demo-tenant-001', name: 'prod-pg-primary', ciType: 'database', environment: 'production', status: 'operational', tags: ['postgresql', 'primary', 'rds'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (db_replica:CI { id: 'ci-db-pg-replica', tenantId: 'demo-tenant-001', name: 'prod-pg-replica-01', ciType: 'database', environment: 'production', status: 'operational', tags: ['postgresql', 'replica'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (api_svc:CI { id: 'ci-svc-api', tenantId: 'demo-tenant-001', name: 'iivkis-api-service', ciType: 'service', environment: 'production', status: 'operational', tags: ['api', 'backend'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (orch_svc:CI { id: 'ci-svc-orchestrator', tenantId: 'demo-tenant-001', name: 'iivkis-orchestrator', ciType: 'service', environment: 'production', status: 'operational', tags: ['orchestrator', 'ai'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (core_router:CI { id: 'ci-net-core-router', tenantId: 'demo-tenant-001', name: 'core-router-01', ciType: 'network', environment: 'production', status: 'operational', tags: ['cisco', 'ios-xe', 'core'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

MERGE (redis_ci:CI { id: 'ci-cache-redis', tenantId: 'demo-tenant-001', name: 'prod-redis-cluster', ciType: 'cache', environment: 'production', status: 'operational', tags: ['redis', 'cache'], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' });

// ── Dependency edges ──────────────────────────────────────────────────────────

// Services depend on databases and cache
MERGE (api_svc)-[:DEPENDS_ON { weight: 1, description: 'Primary data store' }]->(db_primary);
MERGE (api_svc)-[:DEPENDS_ON { weight: 1, description: 'Session cache' }]->(redis_ci);
MERGE (orch_svc)-[:DEPENDS_ON { weight: 1, description: 'Task queue + state' }]->(redis_ci);
MERGE (orch_svc)-[:DEPENDS_ON { weight: 0.5, description: 'Audit log' }]->(db_primary);
MERGE (db_replica)-[:DEPENDS_ON { weight: 1, description: 'Streams from primary' }]->(db_primary);

// Cluster/datacenter containment
MERGE (cluster1)-[:PART_OF]->(dc1);
MERGE (api_svc)-[:PART_OF]->(cluster1);
MERGE (orch_svc)-[:PART_OF]->(cluster1);

// Network dependency
MERGE (cluster1)-[:DEPENDS_ON { weight: 1, description: 'Upstream routing' }]->(core_router);

// CI advisory links (router running affected IOS XE version)
MERGE (core_router)-[:HAS_ADVISORY { detectedAt: '2024-03-16T00:00:00Z' }]->(adv1);
MERGE (db_primary)-[:HAS_ADVISORY { detectedAt: '2024-02-09T00:00:00Z' }]->(adv2);

// ── Knowledge Articles (seed) ─────────────────────────────────────────────────

MERGE (ka1:KnowledgeArticle { id: 'ka-cisco-patch-guide', tenantId: null, title: 'Cisco IOS XE CVE-2024-20399 Remediation Guide', summary: 'Step-by-step guide to patching Cisco IOS XE routers affected by CVE-2024-20399', tags: ['cisco', 'ios-xe', 'cve', 'patch'], sourceType: 'manual', createdAt: '2024-03-17T00:00:00Z', updatedAt: '2024-03-17T00:00:00Z' });

MERGE (ka2:KnowledgeArticle { id: 'ka-pg-upgrade-16', tenantId: null, title: 'PostgreSQL 16 Upgrade Runbook', summary: 'Safe upgrade procedure from PostgreSQL 15.x to 16.2 with rollback plan', tags: ['postgresql', 'upgrade', 'runbook'], sourceType: 'vendor_api', createdAt: '2024-02-10T00:00:00Z', updatedAt: '2024-02-10T00:00:00Z' });

MERGE (ka3:KnowledgeArticle { id: 'ka-k8s-oom-troubleshoot', tenantId: 'demo-tenant-001', title: 'Kubernetes OOMKilled Pod Troubleshooting', summary: 'Diagnose and resolve OOMKilled pods in production Kubernetes clusters', tags: ['kubernetes', 'oom', 'memory', 'troubleshooting'], sourceType: 'manual', createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-01-15T00:00:00Z' });

MERGE (ka1)-[:REFERENCES]->(adv1);
MERGE (ka1)-[:REFERENCES]->(core_router);
MERGE (ka2)-[:REFERENCES]->(db_primary);
MERGE (ka3)-[:REFERENCES]->(cluster1);
