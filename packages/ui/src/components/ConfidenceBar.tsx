import React from 'react';

export interface ConfidenceBarProps {
  value: number;
  color?: string;
}

export function ConfidenceBar({ value, color }: ConfidenceBarProps) {
  const fill = Math.min(100, Math.max(0, value));
  const fillStyle: React.CSSProperties = { width: `${fill}%` };
  if (color) {
    fillStyle['background'] = color;
  }
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-header">
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>Confidence</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--color-cyan)' }}>{fill}%</span>
      </div>
      <div className="confidence-bar-track">
        <div className="confidence-bar-fill" style={fillStyle} />
      </div>
    </div>
  );
}
