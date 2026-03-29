/** Jira issue (REST API v3). */
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: { content?: unknown[] };
    priority: { name: string };
    status: { name: string };
    created: string;
    assignee?: { displayName: string };
    labels: string[];
  };
}

/** Jira search response. */
export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

/** Jira webhook payload (issue created/updated events). */
export interface JiraWebhookBody {
  webhookEvent: string;
  issue_event_type_name?: string;
  issue?: JiraIssue;
  [key: string]: unknown;
}
