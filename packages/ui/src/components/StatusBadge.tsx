import * as React from 'react';

export type BadgeStatus = 'online' | 'warning' | 'error' | 'info';

export interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={`status-badge ${status}`}>{label}</span>;
}
