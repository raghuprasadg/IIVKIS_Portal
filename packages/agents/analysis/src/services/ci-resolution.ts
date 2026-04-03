import { createHash } from 'crypto';

export interface CIResolutionInput {
  ciId?: string;
  host?: string;
  hostname?: string;
  ip?: string;
  cloudId?: string;
}

/**
 * CI resolution service that normalizes multi-source identifiers into one CI ID.
 * In full production this should use CMDB/graph-backed lookup. This implementation
 * provides deterministic mapping and in-process cache for stable correlation.
 */
export class CIResolutionService {
  private readonly cache = new Map<string, string>();

  resolve(input: CIResolutionInput): string | undefined {
    const direct = this.clean(input.ciId);
    if (direct) return direct;

    const aliases = [
      this.clean(input.host),
      this.clean(input.hostname),
      this.clean(input.ip),
      this.clean(input.cloudId),
    ].filter((v): v is string => !!v);

    if (aliases.length === 0) return undefined;

    for (const alias of aliases) {
      const cached = this.cache.get(alias);
      if (cached) return cached;
    }

    const canonical = `ci-${createHash('sha1').update(aliases.sort().join('|')).digest('hex').slice(0, 16)}`;
    for (const alias of aliases) {
      this.cache.set(alias, canonical);
    }
    return canonical;
  }

  private clean(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const v = value.trim().toLowerCase();
    return v.length > 0 ? v : undefined;
  }
}
