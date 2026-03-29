import type { Signal } from '@iivkis/shared';
import { ConnectorRegistry } from '../connectors/registry';
import type { IntegrationConfig, WebhookPayload } from '../connectors/types';
import { validateHmacSignature } from './validator';

/**
 * Process an inbound webhook payload:
 *  1. Validate HMAC signature when webhookSecret is configured.
 *  2. Look up the registered connector for the integration type.
 *  3. Delegate to the connector's processWebhook() method.
 *  4. Return the emitted signals.
 */
export async function handleInboundWebhook(
  payload: WebhookPayload,
  config: IntegrationConfig,
): Promise<Signal[]> {
  if (config.webhookSecret) {
    if (!payload.signature) {
      throw new Error('Webhook signature missing but webhookSecret is configured');
    }
    const rawBody = JSON.stringify(payload.rawBody);
    const valid = validateHmacSignature(rawBody, payload.signature, config.webhookSecret);
    if (!valid) {
      throw new Error('Webhook HMAC signature validation failed');
    }
  }

  const connector = ConnectorRegistry.get(config.connectorType);
  return connector.processWebhook(payload, config);
}
