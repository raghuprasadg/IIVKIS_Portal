/** PagerDuty incident (REST API v2). */
export interface PDIncident {
  id: string;
  title: string;
  status: string;
  urgency: 'high' | 'low';
  created_at: string;
  service: { id: string; summary: string };
}

/** PagerDuty alert (REST API v2). */
export interface PDAlert {
  id: string;
  type: string;
  summary: string;
  severity: string;
  created_at: string;
  body?: { details?: Record<string, unknown> };
}

/** PagerDuty incidents list response. */
export interface PDIncidentsResponse {
  incidents: PDIncident[];
  limit: number;
  offset: number;
  more: boolean;
  total: number | null;
}

/** PagerDuty webhook v3 event. */
export interface PDWebhookEvent {
  event_type: string;
  id: string;
  occurred_at: string;
  agent?: { html_url: string; id: string; self: string; summary: string; type: string };
  client?: { name: string };
  data?: {
    id?: string;
    type?: string;
    html_url?: string;
    number?: number;
    status?: string;
    incident_number?: number;
    title?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    urgency?: string;
    service?: { id: string; summary: string };
  };
}

/** Top-level PagerDuty webhook v3 payload. */
export interface PDWebhookPayload {
  event: PDWebhookEvent;
}
