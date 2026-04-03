/** Root Cause Analysis output payload. */
export interface RCAResult {
  root_cause: string;
  impacted_services: string[];
  confidence: number;
  reasoning: string;
}
