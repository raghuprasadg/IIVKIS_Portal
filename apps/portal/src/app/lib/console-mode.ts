export type ConsoleMode = 'operator' | 'end-user' | 'logged-out';

const KEY = 'iivkis_console_mode';

export function readConsoleMode(): ConsoleMode {
  if (typeof window === 'undefined') return 'operator';
  const value = window.localStorage.getItem(KEY);
  if (value === 'operator' || value === 'end-user' || value === 'logged-out') {
    return value;
  }
  return 'operator';
}

export function saveConsoleMode(mode: ConsoleMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, mode);
}

export function isConsoleAuthenticated(mode: ConsoleMode): boolean {
  return mode !== 'logged-out';
}
