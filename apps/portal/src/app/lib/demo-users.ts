import type { ConsoleMode } from './console-mode';

export interface DemoUser {
  username: string;
  password: string;
  role: 'Operator Admin' | 'Customer Admin' | 'Customer User';
  mode: ConsoleMode;
  displayName: string;
  org: string;
}

/** Demo credentials for prototype only — not for production use */
export const DEMO_USERS: DemoUser[] = [
  {
    username: 'admin@iivkis.io',
    password: 'Admin@IIVKIS2026',
    role: 'Operator Admin',
    mode: 'operator',
    displayName: 'Raghuprasad Gundeti',
    org: 'IIVKIS Platform',
  },
  {
    username: 'cadmin@acme.corp',
    password: 'CAdmin@Acme2026',
    role: 'Customer Admin',
    mode: 'end-user',
    displayName: 'Customer Admin',
    org: 'Acme Corp',
  },
  {
    username: 'user@acme.corp',
    password: 'User@Acme2026',
    role: 'Customer User',
    mode: 'end-user',
    displayName: 'John Doe',
    org: 'Acme Corp',
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
