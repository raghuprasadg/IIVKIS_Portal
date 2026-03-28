/**
 * Troubleshooting types — describes incidents and resolution structures.
 */

/** Severity levels for an IT incident. */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

/** An IT incident or support ticket. */
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedProductId: string;
  reportedAt: string;
  resolvedAt?: string;
}

/** A resolution step recommended by the troubleshooting agent. */
export interface ResolutionStep {
  order: number;
  action: string;
  expectedOutcome: string;
  rollbackAction?: string;
}

/** A full troubleshooting resolution plan. */
export interface ResolutionPlan {
  incidentId: string;
  steps: ResolutionStep[];
  estimatedResolutionTimeMinutes: number;
  generatedAt: string;
}
