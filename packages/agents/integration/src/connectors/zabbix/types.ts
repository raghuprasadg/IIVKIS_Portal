/** Zabbix problem event. */
export interface ZabbixProblem {
  eventid: string;
  objectid: string;
  name: string;
  /** '0'=Not classified, '1'=Info, '2'=Warning, '3'=Average, '4'=High, '5'=Disaster. */
  severity: string;
  /** Unix timestamp (seconds). */
  clock: string;
  acknowledged: string;
  /** Set when the problem is resolved. */
  r_eventid?: string;
}

/** JSON-RPC 2.0 response wrapper. */
export interface ZabbixApiResponse<T> {
  jsonrpc: string;
  result: T;
  id: number;
}

/** Zabbix user.login response. */
export type ZabbixAuthResponse = ZabbixApiResponse<string>;

/** Zabbix webhook body sent by a media-type action script. */
export interface ZabbixWebhookBody {
  eventid?: string;
  name?: string;
  severity?: string;
  clock?: string;
  acknowledged?: string;
  host?: string;
  [key: string]: unknown;
}
