/**
 * Calendly ingest — primary path: invitee.created / invitee.canceled webhooks.
 * Sync poll is catch-up only.
 */

import { DemoService } from '@/services/demo.service';
import { SchedulerService } from '@/services/scheduler.service';
import type { CalendlyEvent } from '@/types/demo';

export type IngestCreatedResult = {
  demo_id: string;
  demo_type: string;
  created: boolean;
  jobs_scheduled: number;
  superseded: number;
  reclassified: boolean;
  compacted: string[];
};

export class CalendlyIngestService {
  static async processInviteeCreated(event: CalendlyEvent): Promise<IngestCreatedResult> {
    const eventId = event.payload.scheduled_event.uuid;
    const existing = await DemoService.getByCalendlyEventId(eventId);

    if (existing) {
      const hasJobs = await SchedulerService.hasPendingJobs(existing.id);
      if (hasJobs) {
        console.log(`[INGEST] Duplicate webhook for ${eventId} — jobs already exist`);
        return {
          demo_id: existing.id,
          demo_type: existing.demo_type,
          created: false,
          jobs_scheduled: 0,
          superseded: 0,
          reclassified: false,
          compacted: [],
        };
      }
      const { demo, jobs, reclassified, compacted } = await SchedulerService.scheduleSequence(existing);
      return {
        demo_id: demo.id,
        demo_type: demo.demo_type,
        created: false,
        jobs_scheduled: jobs.length,
        superseded: 0,
        reclassified,
        compacted,
      };
    }

    const { demo, created, superseded } = await DemoService.createFromCalendly(event);
    const { demo: scheduledDemo, jobs, reclassified, compacted } =
      await SchedulerService.scheduleSequence(demo);

    console.log(
      `[INGEST] Demo ${scheduledDemo.id} (${scheduledDemo.demo_type}) created=${created} jobs=${jobs.length} superseded=${superseded}`
    );

    return {
      demo_id: scheduledDemo.id,
      demo_type: scheduledDemo.demo_type,
      created,
      jobs_scheduled: jobs.length,
      superseded,
      reclassified,
      compacted,
    };
  }

  static async processInviteeCanceled(event: CalendlyEvent): Promise<{ demo_id?: string; canceled: boolean }> {
    const eventId = event.payload.scheduled_event.uuid;
    await DemoService.cancel(eventId);
    const demo = await DemoService.getByCalendlyEventId(eventId);
    if (demo) {
      await SchedulerService.cancelAllJobs(demo.id);
      console.log(`[INGEST] Demo ${demo.id} canceled, jobs cleared`);
      return { demo_id: demo.id, canceled: true };
    }
    return { canceled: false };
  }
}
