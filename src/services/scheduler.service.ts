/**
 * Scheduler Service v3
 * Reduced, sharp follow-up sequences
 *
 * SAME_DAY (<4h): 3 touches — email confirm, SMS 30m, join link 10m
 * NEXT_DAY:       4 touches — confirm, T-4h reminder (email/SMS), SMS 30m, join link
 * FUTURE:         5 touches — confirm, T-24h SMS, T-4h value bomb, SMS 30m, join link
 */

import { db } from '@/lib/db';
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

export class SchedulerService {
  /**
   * Schedule all jobs for a demo
   */
  static async scheduleSequence(demo: Demo): Promise<void> {
    const sequence = SEQUENCES[demo.demo_type];
    const scheduledAt = new Date(demo.scheduled_at).getTime();
    const now = Date.now();

    for (const step of sequence) {
      let scheduledFor: Date;

      const isImmediateMessage =
        step.messageType === 'CONFIRM_INITIAL';

      if (isImmediateMessage) {
        scheduledFor = new Date(now + step.offset);
      } else {
        scheduledFor = new Date(scheduledAt + step.offset);
      }

      // Skip if in the past
      if (scheduledFor.getTime() < now) {
        console.log(`Skipping ${step.messageType} - in the past`);
        continue;
      }

      await this.scheduleJob(demo, step.messageType, scheduledFor);
    }
  }

  /**
   * Schedule a single job
   */
  static async scheduleJob(
    demo: Demo,
    messageType: MessageType,
    scheduledFor: Date
  ): Promise<ScheduledJob> {
    console.log(`Scheduling ${messageType} for ${demo.email} at ${scheduledFor.toISOString()}`);
    
    const job = await db.jobs.upsert({
      demo_id: demo.id,
      qstash_message_id: null,
      message_type: messageType,
      scheduled_for: scheduledFor.toISOString(),
      executed: false,
      cancelled: false,
    });

    return job;
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

    if (['CANCELLED', 'RESCHEDULED'].includes(demo.status)) {
      return false;
    }

    return true;
  }
}
