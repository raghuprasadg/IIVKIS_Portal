/**
 * Sync job scheduler (stub).
 *
 * In a full implementation this module would maintain a timer wheel or
 * interact with a job-queue (e.g. BullMQ / pg_cron) to enqueue sync jobs
 * for each enabled integration at the cadence defined by
 * IntegrationConfig.syncIntervalMinutes.
 *
 * For now it exposes the scheduling contract so that dependent code can be
 * written against the interface.
 */
import type { IntegrationConfig } from '../connectors/types';

export interface ScheduledJob {
  integrationId: string;
  nextRunAt: string;
  intervalMinutes: number;
}

/** In-memory job store (replace with persistent queue in production). */
const jobs = new Map<string, ScheduledJob>();

/** Register or update a sync schedule for an integration. */
export function scheduleSync(config: IntegrationConfig): ScheduledJob {
  const nextRunAt = new Date(
    Date.now() + config.syncIntervalMinutes * 60_000,
  ).toISOString();

  const job: ScheduledJob = {
    integrationId: config.id,
    nextRunAt,
    intervalMinutes: config.syncIntervalMinutes,
  };

  jobs.set(config.id, job);
  console.log(
    `[scheduler] Scheduled sync for integration ${config.id} every ${config.syncIntervalMinutes}m (next: ${nextRunAt})`,
  );
  return job;
}

/** Remove a scheduled job. */
export function unscheduleSync(integrationId: string): void {
  jobs.delete(integrationId);
  console.log(`[scheduler] Removed schedule for integration ${integrationId}`);
}

/** List all scheduled jobs. */
export function listScheduledJobs(): ScheduledJob[] {
  return Array.from(jobs.values());
}
