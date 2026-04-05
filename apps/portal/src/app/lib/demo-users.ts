import type { ConsoleMode } from './console-mode';

export type PortalRole = 'Platform Admin' | 'Company Admin' | 'Company Engineer';

export interface DemoUser {
  username: string;
  password: string;
  role: PortalRole;
  mode: ConsoleMode;
  displayName: string;
  org: string;
  userId: string;
  tenantId: string;
}

export interface RoleCapabilities {
  canCreateIncident: boolean;
  canManageIntegrations: boolean;
  canManageSettings: boolean;
  canCreateKnowledge: boolean;
  canViewAnalytics: boolean;
  canUseChat: boolean;
  canUseIncidents: boolean;
  canUseKnowledge: boolean;
  canUseCorrelations: boolean;
  canManageSubscriptions: boolean;
  canViewUtilization: boolean;
  canViewTelemetry: boolean;
  canViewBilling: boolean;
  canRaisePlatformTickets: boolean;
}

export type PortalSection =
  | 'dashboard'
  | 'chat'
  | 'incidents'
  | 'knowledge'
  | 'correlations'
  | 'integrations'
  | 'subscriptions'
  | 'utilization'
  | 'telemetry'
  | 'billing'
  | 'platform-support'
  | 'analytics'
  | 'settings';

/** Demo credentials for prototype only — not for production use */
export const DEMO_USERS: DemoUser[] = [
  {
    username: 'admin@iivkis.io',
    password: 'Admin@IIVKIS2026',
    role: 'Platform Admin',
    mode: 'operator',
    displayName: 'Raghuprasad Gundeti',
    org: 'IIVKIS Platform',
    userId: 'operator-admin-01',
    tenantId: 'iivkis-platform',
  },
  {
    username: 'cadmin@acme.corp',
    password: 'CAdmin@Acme2026',
    role: 'Company Admin',
    mode: 'end-user',
    displayName: 'Acme Admin Desk',
    org: 'Acme Corp',
    userId: 'acme-admin-01',
    tenantId: 'tenant-uat',
  },
  {
    username: 'user@acme.corp',
    password: 'User@Acme2026',
    role: 'Company Engineer',
    mode: 'end-user',
    displayName: 'John Doe',
    org: 'Acme Corp',
    userId: 'acme-user-01',
    tenantId: 'tenant-uat',
  },
];

const SESSION_KEY = 'iivkis_session_user';

export function findUser(username: string, password: string): DemoUser | null {
  return (
    DEMO_USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password,
    ) ?? null
  );
}

export function saveSessionUser(user: DemoUser): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function readSessionUser(): DemoUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function clearSessionUser(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getRoleCapabilities(user: DemoUser | null): RoleCapabilities {
  switch (user?.role) {
    case 'Platform Admin':
      return {
        canCreateIncident: true,
        canManageIntegrations: true,
        canManageSettings: true,
        canCreateKnowledge: true,
        canViewAnalytics: true,
        canUseChat: true,
        canUseIncidents: true,
        canUseKnowledge: true,
        canUseCorrelations: true,
        canManageSubscriptions: true,
        canViewUtilization: true,
        canViewTelemetry: true,
        canViewBilling: true,
        canRaisePlatformTickets: true,
      };
    case 'Company Admin':
      return {
        canCreateIncident: false,
        canManageIntegrations: true,
        canManageSettings: true,
        canCreateKnowledge: false,
        canViewAnalytics: true,
        canUseChat: false,
        canUseIncidents: false,
        canUseKnowledge: false,
        canUseCorrelations: false,
        canManageSubscriptions: true,
        canViewUtilization: true,
        canViewTelemetry: true,
        canViewBilling: true,
        canRaisePlatformTickets: true,
      };
    case 'Company Engineer':
      return {
        canCreateIncident: true,
        canManageIntegrations: false,
        canManageSettings: false,
        canCreateKnowledge: false,
        canViewAnalytics: false,
        canUseChat: true,
        canUseIncidents: true,
        canUseKnowledge: true,
        canUseCorrelations: true,
        canManageSubscriptions: false,
        canViewUtilization: false,
        canViewTelemetry: false,
        canViewBilling: false,
        canRaisePlatformTickets: false,
      };
    default:
      return {
        canCreateIncident: false,
        canManageIntegrations: false,
        canManageSettings: false,
        canCreateKnowledge: false,
        canViewAnalytics: false,
        canUseChat: false,
        canUseIncidents: false,
        canUseKnowledge: false,
        canUseCorrelations: false,
        canManageSubscriptions: false,
        canViewUtilization: false,
        canViewTelemetry: false,
        canViewBilling: false,
        canRaisePlatformTickets: false,
      };
  }
}

export function getRoleAccentColor(role: PortalRole | null | undefined): string {
  switch (role) {
    case 'Platform Admin':
      return 'var(--color-cyan)';
    case 'Company Admin':
      return '#b97aff';
    case 'Company Engineer':
      return 'var(--color-amber)';
    default:
      return 'var(--color-text-muted)';
  }
}

export function canAccessPortalSection(user: DemoUser | null, section: PortalSection): boolean {
  const capabilities = getRoleCapabilities(user);

  switch (section) {
    case 'dashboard':
      return user !== null;
    case 'chat':
      return capabilities.canUseChat;
    case 'incidents':
      return capabilities.canUseIncidents;
    case 'knowledge':
      return capabilities.canUseKnowledge;
    case 'correlations':
      return capabilities.canUseCorrelations;
    case 'integrations':
      return capabilities.canManageIntegrations;
    case 'subscriptions':
      return capabilities.canManageSubscriptions;
    case 'utilization':
      return capabilities.canViewUtilization;
    case 'telemetry':
      return capabilities.canViewTelemetry;
    case 'billing':
      return capabilities.canViewBilling;
    case 'platform-support':
      return capabilities.canRaisePlatformTickets;
    case 'analytics':
      return capabilities.canViewAnalytics;
    case 'settings':
      return capabilities.canManageSettings;
    default:
      return false;
  }
}

export function buildSessionHeaders(user: DemoUser | null): Record<string, string> {
  if (!user) return {};
  return {
    'X-Dev-User-Id': user.userId,
    'X-Dev-Tenant-Id': user.tenantId,
    'X-Dev-Role': user.role,
  };
}
