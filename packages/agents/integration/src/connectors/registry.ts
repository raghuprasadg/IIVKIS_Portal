import type { ConnectorI, ConnectorType } from './types';

/** Registry mapping connector types to their singleton implementations. */
export class ConnectorRegistry {
  private static connectors = new Map<ConnectorType, ConnectorI>();

  static register(connector: ConnectorI): void {
    ConnectorRegistry.connectors.set(connector.type, connector);
  }

  static get(type: ConnectorType): ConnectorI {
    const connector = ConnectorRegistry.connectors.get(type);
    if (!connector) {
      throw new Error(`No connector registered for type: ${type}`);
    }
    return connector;
  }

  static list(): ConnectorType[] {
    return Array.from(ConnectorRegistry.connectors.keys());
  }
}
