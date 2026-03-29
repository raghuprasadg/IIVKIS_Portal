import * as React from 'react';

export interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  icon: string;
  color: string;
}

export function MetricCard({ title, value, trend, icon, color }: MetricCardProps) {
  const isPositive = trend?.startsWith('+') ?? false;
  return (
    <div className="glass-card metric-card">
      <div className="metric-card-header">
        <span className="metric-card-title">{title}</span>
        <span className="metric-card-icon">{icon}</span>
      </div>
      <div className="metric-card-value" style={{ color }}>{value}</div>
      {trend !== undefined && (
        <div className={`metric-card-trend ${isPositive ? 'trend-up' : 'trend-down'}`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}
