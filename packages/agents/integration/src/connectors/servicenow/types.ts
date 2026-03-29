/** ServiceNow incident record (Table API fields we use). */
export interface SNowIncident {
  sys_id: string;
  /** Human-readable number, e.g. INC0001234. */
  number: string;
  short_description: string;
  description?: string;
  /** '1' = Critical, '2' = High, '3' = Moderate, '4' = Low, '5' = Planning. */
  severity: string;
  /** '1' = New/Open, '6' = Resolved, '7' = Closed. */
  state: string;
  /** ISO timestamp. */
  opened_at: string;
  cmdb_ci?: { value: string; display_value: string };
  assigned_to?: { value: string; display_value: string };
}

/** Wrapper returned by the ServiceNow Table API. */
export interface SNowTableResponse<T> {
  result: T[];
}

/** Inbound Business Rule webhook body from ServiceNow. */
export interface SNowWebhookBody {
  table_sys_id?: string;
  event_name?: string;
  incident?: Partial<SNowIncident>;
  [key: string]: unknown;
}
