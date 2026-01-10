/**
 * Scheduler Service
 * Manages job scheduling - works locally without QStash
 * Jobs are stored in DB and processed by /api/cron
 */

import { db } from '@/lib/db';
import type { Demo, DemoType, MessageType, ScheduledJob } from '@/types/demo';
import { TIMING } from '@/lib/config';

type SequenceStep = {
  messageType: MessageType;
  offset: number; // ms from scheduled_at (negative = before)
  requiresConfirmation?: boolean;
};

const SEQUENCES: Record<DemoType, SequenceStep[]> = {
  SAME_DAY: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'CONFIRM_REMINDER', offset: -TIMING.SAME_DAY.T_MINUS_60M },
    { messageType: 'SMS_REMINDER', offset: -TIMING.SMS.T_MINUS_2H },
    { messageType: 'JOIN_LINK', offset: -TIMING.SAME_DAY.T_MINUS_10M },
    { messageType: 'SMS_JOIN_LINK', offset: -TIMING.SMS.T_MINUS_5M },
    { messageType: 'JOIN_URGENT', offset: TIMING.SAME_DAY.T_PLUS_2M },
    { messageType: 'SMS_URGENT', offset: TIMING.SMS.T_PLUS_5M },
  ],
  NEXT_DAY: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'RECEIPT', offset: 1000 },
    { messageType: 'CONFIRM_REMINDER', offset: -TIMING.NEXT_DAY.T_MINUS_4H },
    { messageType: 'SMS_REMINDER', offset: -TIMING.SMS.T_MINUS_2H },
    { messageType: 'JOIN_LINK', offset: -TIMING.NEXT_DAY.T_MINUS_10M },
    { messageType: 'SMS_JOIN_LINK', offset: -TIMING.SMS.T_MINUS_5M },
    { messageType: 'JOIN_URGENT', offset: TIMING.SAME_DAY.T_PLUS_2M },
    { messageType: 'SMS_URGENT', offset: TIMING.SMS.T_PLUS_5M },
  ],
  FUTURE: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'CONFIRM_REMINDER', offset: TIMING.FUTURE.T_PLUS_24H },
    { messageType: 'SOONER_OFFER', offset: -TIMING.FUTURE.T_MINUS_48H },
    { messageType: 'DAY_OF_REMINDER', offset: -TIMING.FUTURE.T_MINUS_4H },
    { messageType: 'SMS_REMINDER', offset: -TIMING.SMS.T_MINUS_2H },
    { messageType: 'JOIN_LINK', offset: -TIMING.FUTURE.T_MINUS_10M },
    { messageType: 'SMS_JOIN_LINK', offset: -TIMING.SMS.T_MINUS_5M },
    { messageType: 'JOIN_URGENT', offset: TIMING.FUTURE.T_PLUS_2M },
    { messageType: 'SMS_URGENT', offset: TIMING.SMS.T_PLUS_5M },
  ],
};

export class SchedulerService {
  /**
   * Schedule all jobs for a demo - stores in DB
   * No QStash needed
   */
  static async scheduleSequence(demo: Demo): Promise<void> {
    const sequence = SEQUENCES[demo.demo_type];
    const scheduledAt = new Date(demo.scheduled_at).getTime();
    const now = Date.now();

    for (const step of sequence) {
      let scheduledFor: Date;

      // T0 messages: send now
      if (step.messageType === 'CONFIRM_INITIAL' || step.messageType === 'RECEIPT') {
        scheduledFor = new Date(now + step.offset);
      } else if (step.messageType === 'CONFIRM_REMINDER' && demo.demo_type === 'FUTURE') {
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
   * Schedule a single job - just insert into DB
   */
  static async scheduleJob(
    demo: Demo,
    messageType: MessageType,
    scheduledFor: Date
  ): Promise<ScheduledJob> {
    console.log(`Scheduling ${messageType} for ${demo.email} at ${scheduledFor.toISOString()}`);
    
    const job = await db.jobs.upsert({
      demo_id: demo.id,
      qstash_message_id: null, // Not using QStash
      message_type: messageType,
      scheduled_for: scheduledFor.toISOString(),
      executed: false,
      cancelled: false,
    });

    return job;
  }

  /**
   * Cancel all pending jobs for a demo
   */
  static async cancelAllJobs(demoId: string): Promise<void> {
    await db.jobs.cancel(demoId);
  }

  /**
   * Cancel specific job types
   */
  static async cancelJobTypes(demoId: string, messageTypes: MessageType[]): Promise<void> {
    await db.jobs.cancel(demoId, messageTypes);
  }

  /**
   * Mark job as executed
   */
  static async markExecuted(demoId: string, messageType: MessageType): Promise<void> {
    await db.jobs.markExecuted(demoId, messageType);
  }

  /**
   * Check if job should execute
   */
  static async shouldExecute(demoId: string, messageType: MessageType): Promise<boolean> {
    const job = await db.jobs.findByDemoAndType(demoId, messageType);
    if (!job || job.cancelled) return false;

    const demo = await db.demos.findById(demoId);
    if (!demo) return false;

    // Only skip if explicitly cancelled or rescheduled
    if (['CANCELLED', 'RESCHEDULED'].includes(demo.status)) {
      return false;
    }

    return true;
  }
}
