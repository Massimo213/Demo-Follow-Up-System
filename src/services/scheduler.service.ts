/**
 * Scheduler Service v2
 * Sharp, consequence-driven sequences
 * 6-7 meaningful touches, not 9 fluffy ones
 * 
 * SAME_DAY: 4 touches + 2 no-show = 6
 * NEXT_DAY: 6 touches + 2 no-show = 8
 * FUTURE:   7 touches + 2 no-show = 9
 */

import { db } from '@/lib/db';
import type { Demo, DemoType, MessageType, ScheduledJob } from '@/types/demo';
import { TIMING } from '@/lib/config';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

type SequenceStep = {
  messageType: MessageType;
  offset: number;
  specialTiming?: 'EVENING_BEFORE'; // computed dynamically
};

const SEQUENCES: Record<DemoType, SequenceStep[]> = {
  // SAME_DAY: 4 before + 2 no-show
  SAME_DAY: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'SMS_CONFIRM', offset: 2000 },
    { messageType: 'SMS_REMINDER', offset: -TIMING.SAME_DAY.T_MINUS_30M },
    { messageType: 'JOIN_LINK', offset: -TIMING.SAME_DAY.T_MINUS_10M },
    { messageType: 'SMS_URGENT', offset: TIMING.SAME_DAY.T_PLUS_8M },
    { messageType: 'POST_NO_SHOW', offset: TIMING.SAME_DAY.T_PLUS_1H },
  ],

  // NEXT_DAY: 6 before + 2 no-show
  NEXT_DAY: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'SMS_CONFIRM', offset: 2000 },
    { messageType: 'EVENING_BEFORE', offset: 0, specialTiming: 'EVENING_BEFORE' },
    { messageType: 'CONFIRM_REMINDER', offset: -TIMING.NEXT_DAY.T_MINUS_4H },
    { messageType: 'SMS_REMINDER', offset: -TIMING.NEXT_DAY.T_MINUS_30M },
    { messageType: 'JOIN_LINK', offset: -TIMING.NEXT_DAY.T_MINUS_10M },
    { messageType: 'SMS_URGENT', offset: TIMING.NEXT_DAY.T_PLUS_8M },
    { messageType: 'POST_NO_SHOW', offset: TIMING.NEXT_DAY.T_PLUS_1H },
  ],

  // FUTURE: 7 before + 2 no-show
  FUTURE: [
    { messageType: 'CONFIRM_INITIAL', offset: 0 },
    { messageType: 'SMS_CONFIRM', offset: 2000 },
    { messageType: 'VALUE_BOMB', offset: -TIMING.FUTURE.T_MINUS_48H },
    { messageType: 'SMS_DAY_BEFORE', offset: -TIMING.FUTURE.T_MINUS_24H },
    { messageType: 'DAY_OF_REMINDER', offset: -TIMING.FUTURE.T_MINUS_4H },
    { messageType: 'SMS_REMINDER', offset: -TIMING.FUTURE.T_MINUS_30M },
    { messageType: 'JOIN_LINK', offset: -TIMING.FUTURE.T_MINUS_10M },
    { messageType: 'SMS_URGENT', offset: TIMING.FUTURE.T_PLUS_8M },
    { messageType: 'POST_NO_SHOW', offset: TIMING.FUTURE.T_PLUS_1H },
  ],
};

/**
 * Calculate 7pm local time the evening before the demo
 */
function calculateEveningBefore(demo: Demo): Date {
  const demoLocal = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  const eveningLocal = new Date(demoLocal);
  eveningLocal.setDate(eveningLocal.getDate() - 1);
  eveningLocal.setHours(19, 0, 0, 0); // 7pm local time
  return fromZonedTime(eveningLocal, demo.timezone);
}

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

      // Immediate messages: send right after booking
      const isImmediateMessage = 
        step.messageType === 'CONFIRM_INITIAL' || 
        step.messageType === 'SMS_CONFIRM';
      
      if (step.specialTiming === 'EVENING_BEFORE') {
        // Special: 7pm local time the evening before
        scheduledFor = calculateEveningBefore(demo);
      } else if (isImmediateMessage) {
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
