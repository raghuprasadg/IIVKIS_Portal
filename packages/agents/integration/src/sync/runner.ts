import { ConnectorRegistry } from '../connectors/registry';
import type { IntegrationConfig, SyncResult } from '../connectors/types';

/**
 * Execute a full or incremental sync for a single integration.
 *
 * Resolves the connector from the registry, determines the `since` date for
 * incremental syncs, and delegates to connector.sync().
 */
export async function runSync(
  config: IntegrationConfig,
  since?: Date,
): Promise<SyncResult> {
  const connector = ConnectorRegistry.get(config.connectorType);

  const effectiveSince =
    since ??
    (config.syncMode === 'incremental' && config.lastSyncAt
      ? new Date(config.lastSyncAt)
      : undefined);

  console.log(
    `[runner] Starting ${config.syncMode} sync for integration ${config.id} (${config.connectorType})` +
      (effectiveSince ? ` since ${effectiveSince.toISOString()}` : ''),
  );

  const result = await connector.sync(config, effectiveSince);

  console.log(
    `[runner] Sync complete for ${config.id}: ` +
      `${result.recordsNew} new, ${result.recordsUpdated} updated, ` +
      `${result.errors.length} errors, ${result.durationMs}ms`,
  );

  return result;
}
