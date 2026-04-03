/**
 * KGService — Knowledge Graph topology service (Phase 6).
 *
 * Provides signal-enrichment helpers consumed by the analysis agent before
 * feeding signals into the Correlation Engine.
 *
 * In production this talks to Neo4j via the configured NEO4J_URI endpoint.
 * During Phase 6 validation (no external Neo4j) the service operates in stub
 * mode: topology depths are derived deterministically from the CI UUID so that
 * tests are reproducible without real infrastructure.
 */

import { createHash } from 'crypto';
import neo4j, { type Driver } from 'neo4j-driver';

export interface KGTopologyInfo {
  /** Hop distance from the tenant root CI (0 = root, 1 = direct child, …). */
  topologyDepth: number;
  /** Direct dependency neighbour CI IDs. */
  neighbors: string[];
}

export class KGService {
  private readonly isStub: boolean;
  private readonly driver?: Driver;

  constructor() {
    this.isStub = !process.env['NEO4J_URI'];
    if (!this.isStub) {
      this.driver = neo4j.driver(
        process.env['NEO4J_URI']!,
        neo4j.auth.basic(
          process.env['NEO4J_USER'] ?? 'neo4j',
          process.env['NEO4J_PASSWORD'] ?? 'iivkis_dev_pass',
        ),
      );
    }
    if (this.isStub) {
      console.log('[KGService] No NEO4J_URI set — operating in topology-stub mode.');
    }
  }

  /**
   * Look up topology depth for a CI node.
   *
   * Stub mode: derives a deterministic depth (0–3) from the CI ID hash so
   * that signals sharing the same CI always receive the same depth.
   */
  async getTopologyInfo(ciId: string): Promise<KGTopologyInfo> {
    if (this.isStub) {
      return this.stubTopologyInfo(ciId);
    }

    const session = this.driver!.session();
    try {
      const result = await session.run(
        `
        MATCH (c:CI {id: $ciId})
        OPTIONAL MATCH p=(c)-[:PART_OF|DEPENDS_ON*1..4]->(:CI)
        WITH c, min(length(p)) AS minDepth
        OPTIONAL MATCH (c)-[:DEPENDS_ON]->(n:CI)
        RETURN coalesce(minDepth, 0) AS topologyDepth, collect(DISTINCT n.id) AS neighbors
        `,
        { ciId },
      );

      const row = result.records[0];
      if (!row) return this.stubTopologyInfo(ciId);

      const topologyDepth = Number(row.get('topologyDepth'));
      const neighbors = (row.get('neighbors') as string[]).filter(Boolean);
      return { topologyDepth, neighbors };
    } catch {
      return this.stubTopologyInfo(ciId);
    } finally {
      await session.close();
    }
  }

  /**
   * Batch-enrich an array of CI IDs, returning a map of ciId → topology info.
   * Deduplicates CI IDs to avoid redundant lookups.
   */
  async batchGetTopologyInfo(
    ciIds: string[],
  ): Promise<Map<string, KGTopologyInfo>> {
    const unique = [...new Set(ciIds.filter(Boolean))];
    const results = await Promise.all(
      unique.map(async id => [id, await this.getTopologyInfo(id)] as const),
    );
    return new Map(results);
  }

  /* ── private helpers ───────────────────────────────────────────────────── */

  private stubTopologyInfo(ciId: string): KGTopologyInfo {
    // Derive a 0–3 depth from the first byte of the SHA-256 hash of the CI ID.
    const hash = createHash('sha256').update(ciId).digest();
    const depth = (hash[0]! % 4) as 0 | 1 | 2 | 3;

    // Build up to 2 deterministic neighbour IDs from subsequent hash bytes.
    const neighbor1 = hash.slice(1, 17).toString('hex');
    const neighbor2 = hash.slice(17, 33).toString('hex');
    const neighbors = depth < 3 ? [neighbor1, neighbor2] : [];

    return { topologyDepth: depth, neighbors };
  }

  async addEvent(eventId: string, ciId: string, payload: Record<string, unknown>): Promise<void> {
    if (this.isStub) return;
    const session = this.driver!.session();
    try {
      await session.run(
        `
        MERGE (e:Event {id: $eventId})
        SET e += $payload
        MERGE (c:CI {id: $ciId})
        MERGE (e)-[:AFFECTS]->(c)
        `,
        { eventId, ciId, payload },
      );
    } finally {
      await session.close();
    }
  }

  async linkCi(fromCiId: string, toCiId: string): Promise<void> {
    if (this.isStub) return;
    const session = this.driver!.session();
    try {
      await session.run(
        `
        MERGE (a:CI {id: $fromCiId})
        MERGE (b:CI {id: $toCiId})
        MERGE (a)-[:DEPENDS_ON]->(b)
        `,
        { fromCiId, toCiId },
      );
    } finally {
      await session.close();
    }
  }

  async traverseGraph(ciId: string, maxHops = 2): Promise<string[]> {
    if (this.isStub) {
      return this.stubTopologyInfo(ciId).neighbors;
    }

    const session = this.driver!.session();
    try {
      const result = await session.run(
        `
        MATCH p=(c:CI {id: $ciId})-[:DEPENDS_ON*1..4]->(n:CI)
        WHERE length(p) <= $maxHops
        RETURN collect(DISTINCT n.id) AS ids
        `,
        { ciId, maxHops: neo4j.int(maxHops) },
      );
      const row = result.records[0];
      return row ? (row.get('ids') as string[]) : [];
    } catch {
      return [];
    } finally {
      await session.close();
    }
  }
}
