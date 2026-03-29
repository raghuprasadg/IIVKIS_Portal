// IIVKIS Knowledge Graph — Neo4j Schema
// Run once against a fresh Neo4j instance to apply constraints and indexes.
// Compatible with Neo4j 5.x (Aura / self-hosted).
//
// Node labels:    Tenant, CI, Vendor, Product, Version, Advisory, KnowledgeArticle, User
// Relationship types: DEPENDS_ON, HAS_PRODUCT, HAS_VERSION, AFFECTS, RECOMMENDS,
//                     HAS_ADVISORY, ASSIGNED_TO, REFERENCES, PART_OF

// ── Uniqueness constraints ────────────────────────────────────────────────────

CREATE CONSTRAINT tenant_id_unique IF NOT EXISTS
  FOR (t:Tenant) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT ci_id_unique IF NOT EXISTS
  FOR (c:CI) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT vendor_id_unique IF NOT EXISTS
  FOR (v:Vendor) REQUIRE v.id IS UNIQUE;

CREATE CONSTRAINT product_id_unique IF NOT EXISTS
  FOR (p:Product) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT version_id_unique IF NOT EXISTS
  FOR (v:Version) REQUIRE v.id IS UNIQUE;

CREATE CONSTRAINT advisory_id_unique IF NOT EXISTS
  FOR (a:Advisory) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT article_id_unique IF NOT EXISTS
  FOR (ka:KnowledgeArticle) REQUIRE ka.id IS UNIQUE;

CREATE CONSTRAINT user_id_unique IF NOT EXISTS
  FOR (u:User) REQUIRE u.id IS UNIQUE;

// ── Existence constraints (required properties) ───────────────────────────────

CREATE CONSTRAINT ci_tenantId_exists IF NOT EXISTS
  FOR (c:CI) REQUIRE c.tenantId IS NOT NULL;

CREATE CONSTRAINT ci_name_exists IF NOT EXISTS
  FOR (c:CI) REQUIRE c.name IS NOT NULL;

CREATE CONSTRAINT ci_type_exists IF NOT EXISTS
  FOR (c:CI) REQUIRE c.ciType IS NOT NULL;

CREATE CONSTRAINT advisory_severity_exists IF NOT EXISTS
  FOR (a:Advisory) REQUIRE a.severity IS NOT NULL;

// ── Lookup indexes ─────────────────────────────────────────────────────────────

// CIs by tenantId — most common filter
CREATE INDEX ci_tenant_idx IF NOT EXISTS
  FOR (c:CI) ON (c.tenantId);

// CIs by type (server, database, service, network, application)
CREATE INDEX ci_type_idx IF NOT EXISTS
  FOR (c:CI) ON (c.ciType);

// CIs by external CMDB reference id
CREATE INDEX ci_external_id_idx IF NOT EXISTS
  FOR (c:CI) ON (c.externalId);

// Vendors by name (case-sensitive)
CREATE INDEX vendor_name_idx IF NOT EXISTS
  FOR (v:Vendor) ON (v.name);

// Products by vendorId
CREATE INDEX product_vendor_idx IF NOT EXISTS
  FOR (p:Product) ON (p.vendorId);

// Advisories by severity + publishedAt
CREATE INDEX advisory_severity_idx IF NOT EXISTS
  FOR (a:Advisory) ON (a.severity);

CREATE INDEX advisory_publishedAt_idx IF NOT EXISTS
  FOR (a:Advisory) ON (a.publishedAt);

// KnowledgeArticles by tenantId
CREATE INDEX article_tenant_idx IF NOT EXISTS
  FOR (ka:KnowledgeArticle) ON (ka.tenantId);

// ── Full-text search indexes ───────────────────────────────────────────────────

// Free-text search on CI names and descriptions
CREATE FULLTEXT INDEX ci_fulltext IF NOT EXISTS
  FOR (c:CI) ON EACH [c.name, c.description];

// Free-text search on Advisory titles and CVE descriptions
CREATE FULLTEXT INDEX advisory_fulltext IF NOT EXISTS
  FOR (a:Advisory) ON EACH [a.title, a.description, a.cveId];

// Free-text search on KnowledgeArticle titles
CREATE FULLTEXT INDEX article_fulltext IF NOT EXISTS
  FOR (ka:KnowledgeArticle) ON EACH [ka.title, ka.summary];

// ── Node property reference ────────────────────────────────────────────────────
//
// :Tenant     { id, name, slug, isolationTier }
//
// :CI         { id, tenantId, name, ciType, externalId?, description?,
//               environment,          -- production | staging | dev
//               status,               -- operational | degraded | maintenance | decommissioned
//               owner?,               -- team or user UUID
//               tags,                 -- string[]
//               metadata,             -- arbitrary JSON
//               createdAt, updatedAt }
//
// :Vendor     { id, name, website?, logoUrl?, supportEmail?, createdAt }
//
// :Product    { id, vendorId, name, category, description?, createdAt }
//
// :Version    { id, productId, semver, releaseDate, eolDate?, changelogUrl? }
//
// :Advisory   { id, vendorId?, productId?, title, description, severity,
//               cveId?,             -- CVE-2024-XXXXX
//               cvssScore?,         -- 0.0 – 10.0
//               publishedAt, updatedAt,
//               affectedVersions,   -- string[] semver ranges
//               fixedInVersion?,
//               workaround?,
//               sourceUrl? }
//
// :KnowledgeArticle { id, tenantId?, title, summary?, tags, sourceType,
//                     createdAt, updatedAt }
//
// :User       { id, tenantId, displayName, email }
//
// ── Relationship property reference ───────────────────────────────────────────
//
// (:CI)-[:DEPENDS_ON { weight?, description?, createdAt }]->(:CI)
//   Directed: CI 'from' depends on CI 'to'. KEDA topology traversal follows this edge.
//
// (:Vendor)-[:HAS_PRODUCT]->(:Product)
//   A vendor owns a product.
//
// (:Product)-[:HAS_VERSION { releaseDate? }]->(:Version)
//   A product has a version.
//
// (:Advisory)-[:AFFECTS { versionRange? }]->(:Product)
//   An advisory affects one or more products. May have version range constraint.
//
// (:Advisory)-[:AFFECTS_VERSION]->(:Version)
//   Advisory affects a specific version node.
//
// (:Advisory)-[:RECOMMENDS { action }]->(:Version)
//   Advisory recommends upgrading to a specific version (action = 'upgrade').
//
// (:CI)-[:HAS_ADVISORY { detectedAt }]->(:Advisory)
//   A CI is running an affected product/version; advisory applies.
//
// (:KnowledgeArticle)-[:REFERENCES]->(:CI | :Product | :Advisory | :Vendor)
//   An article references a graph node.
//
// (:CI)-[:PART_OF]->(:CI)
//   Hierarchical containment: a service is part of a cluster is part of a datacenter.
//
// (:User)-[:ASSIGNED_TO]->(:CI)
//   A user/team is responsible for a CI.
