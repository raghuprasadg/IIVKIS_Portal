/**
 * Knowledge Graph node and relationship types (LLD §2.4, §5).
 * These mirror the Neo4j schema defined in infra/neo4j/kg-schema.cypher.
 */

export type CiType =
  | 'datacenter'
  | 'cluster'
  | 'server'
  | 'database'
  | 'cache'
  | 'service'
  | 'network'
  | 'application'
  | 'storage'
  | 'load-balancer';

export type CiEnvironment = 'production' | 'staging' | 'dev' | 'test';
export type CiStatus = 'operational' | 'degraded' | 'maintenance' | 'decommissioned';

/** A Configuration Item (CI) node in the Knowledge Graph. */
export interface KgNode {
  id: string;
  tenantId: string;
  name: string;
  ciType: CiType;
  environment: CiEnvironment;
  status: CiStatus;
  owner?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type KgEdgeType =
  | 'DEPENDS_ON'
  | 'PART_OF'
  | 'HAS_PRODUCT'
  | 'HAS_VERSION'
  | 'HAS_ADVISORY'
  | 'AFFECTS'
  | 'RECOMMENDS'
  | 'REFERENCES'
  | 'ASSIGNED_TO';

/** A directed edge between two KG nodes. */
export interface KgEdge {
  id: string;
  tenantId?: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: KgEdgeType;
  weight?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** A vendor in the KG (global, not tenant-scoped). */
export interface KgVendor {
  id: string;
  name: string;
  website?: string;
  logoUrl?: string;
  supportEmail?: string;
  createdAt: string;
}

/** A vendor product in the KG. */
export interface KgProduct {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  description?: string;
  createdAt: string;
}

/** A product version. */
export interface KgVersion {
  id: string;
  productId: string;
  semver: string;
  releaseDate: string;
  eolDate?: string;
  changelogUrl?: string;
}

/** A vendor security or operational advisory. */
export interface KgAdvisory {
  id: string;
  vendorId?: string;
  productId?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cveId?: string;
  cvssScore?: number;
  publishedAt: string;
  updatedAt: string;
  affectedVersions: string[];
  fixedInVersion?: string;
  workaround?: string;
  sourceUrl?: string;
}

/** Result of a KG topology traversal — hop-annotated CI list. */
export interface KgTraversalResult {
  rootCiId: string;
  reachableCis: Array<{
    ciId: string;
    hops: number;
    path: string[];           // ordered CI IDs from root to this node
    edgeTypes: KgEdgeType[];  // edge types along the path
  }>;
}
