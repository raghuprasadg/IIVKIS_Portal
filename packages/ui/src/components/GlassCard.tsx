import React from 'react';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className = '', glow = false }: GlassCardProps) {
  const classes = ['glass-card', glow ? 'glow' : '', className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
