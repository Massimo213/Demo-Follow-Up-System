/**
 * Scheduler Service v4
 * Commitment ladder system — escalating engagement, not passive reminders.
 *
 * Delayed ingest: reclassify demo_type from NOW, then compact missed steps
 * (fire immediately if ideal time passed but meeting has not started).
 */

import { db } from '@/lib/db';
import { DemoService } from '@/services/demo.service';
import { resolveStepSchedule } from '@/lib/schedule-compact';
import type { Demo, DemoType, MessageType, ScheduledJob } from '@/types/demo';
import { TIMING } from '@/lib/config';

type SequenceStep = {
  messageType: MessageType;
  offset: number;
};

const SEQUENCES: Record<DemoType, SequenceStep[]> = {
  SAME_DAY: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'SMS_REMINDER', offset: -TIMING.SAME_DAY.T_MINUS_30M },
    { messageType: 'JOIN_LINK', offset: -TIMING.SAME_DAY.T_MINUS_10M },
  ],

  NEXT_DAY: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'CONFIRM_REMINDER', offset: -TIMING.NEXT_DAY.T_MINUS_4H },
    { messageType: 'SMS_REMINDER', offset: -TIMING.NEXT_DAY.T_MINUS_30M },
    { messageType: 'JOIN_LINK', offset: -TIMING.NEXT_DAY.T_MINUS_10M },
  ],

  FUTURE: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'SMS_DAY_BEFORE', offset: -TIMING.FUTURE.T_MINUS_24H },
    { messageType: 'DAY_OF_REMINDER', offset: -TIMING.FUTURE.T_MINUS_4H },
    { messageType: 'SMS_REMINDER', offset: -TIMING.FUTURE.T_MINUS_30M },
    { messageType: 'JOIN_LINK', offset: -TIMING.FUTURE.T_MINUS_10M },
  ],
};

export type ScheduleSequenceResult = {
  demo: Demo;
  jobs: ScheduledJob[];
  reclassified: boolean;
  compacted: MessageType[];
};

export class SchedulerService {
  /**
   * Schedule all jobs for a demo.
   * Reclassifies demo_type from ingest time; compacts missed pre-meeting steps to now.
   */
  static async scheduleSequence(
    demo: Demo,
    opts?: { now?: Date }
  ): Promise<ScheduleSequenceResult> {
    const now = opts?.now ?? new Date();
    const nowMs = now.getTime();
    const scheduledAtMs = new Date(demo.scheduled_at).getTime();

    const demoType = DemoService.classifyDemoType(new Date(demo.scheduled_at), now);
    let reclassified = false;
    if (demoType !== demo.demo_type) {
      demo = await db.demos.updateDemoType(demo.id, demoType);
      reclassified = true;
      console.log(`[SCHEDULER] Reclassified ${demo.email} → ${demoType} (delayed ingest)`);
    }

    const sequence = SEQUENCES[demo.demo_type];
    const jobs: ScheduledJob[] = [];
    const compacted: MessageType[] = [];

    for (const step of sequence) {
      const resolved = resolveStepSchedule({
        messageType: step.messageType,
        offsetMs: step.offset,
        scheduledAtMs,
        nowMs,
      });

      if (resolved.action === 'skip') {
        console.log(`[SCHEDULER] Skip ${step.messageType} — ${resolved.reason}`);
        continue;
      }

      if (resolved.compacted) {
        console.log(`[SCHEDULER] Compact ${step.messageType} → now`);
        compacted.push(step.messageType);
      }

      const job = await this.scheduleJob(demo, step.messageType, new Date(resolved.scheduledForMs));
      jobs.push(job);
    }

    return { demo, jobs, reclassified, compacted };
  }

  static async scheduleJob(
    demo: Demo,
    messageType: MessageType,
    scheduledFor: Date
  ): Promise<ScheduledJob> {
    console.log(`Scheduling ${messageType} for ${demo.email} at ${scheduledFor.toISOString()}`);

    return db.jobs.upsert({
      demo_id: demo.id,
      qstash_message_id: null,
      message_type: messageType,
      scheduled_for: scheduledFor.toISOString(),
      executed: false,
      cancelled: false,
    });
  }

  static async cancelAllJobs(demoId: string): Promise<void> {
    await db.jobs.cancel(demoId);
  }

  static async cancelJobTypes(demoId: string, messageTypes: MessageType[]): Promise<void> {
    await db.jobs.cancel(demoId, messageTypes);
  }

  static async markExecuted(demoId: string, messageType: MessageType): Promise<void> {
    await db.jobs.markExecuted(demoId, messageType);
  }

  static async shouldExecute(demoId: string, messageType: MessageType): Promise<boolean> {
    const job = await db.jobs.findByDemoAndType(demoId, messageType);
    if (!job || job.cancelled) return false;

    const demo = await db.demos.findById(demoId);
    if (!demo) return false;

    if (['CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'COMPLETED'].includes(demo.status)) {
      return false;
    }

    return true;
  }

  static async hasPendingJobs(demoId: string): Promise<boolean> {
    const pending = await db.jobs.findPending(demoId);
    return pending.length > 0;
  }
}
