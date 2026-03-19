/**
 * Prospect Scheduler Service
 * 3-touch automated sequence. Touch 1 (recap + Infrastructure Assessment PDF) is manual.
 *
 * Day 3:  PD_STAKEHOLDER_BRIEF — arm champion with forward-ready internal brief
 * Day 6:  PD_DIRECT_ASK        — make clock hurt, policy decision, 170-agency Delta
 * Day 10: PD_CLOSING_FILE     — close file, 48h final window
 */

import { prospectDb } from '@/lib/prospect-db';
import type { Prospect, ProspectMessageType, ProspectScheduledJob } from '@/types/prospect';

const HOUR = 60 * 60 * 1000;

type SequenceStep = {
  messageType: ProspectMessageType;
  delayMs: number;
};

const POST_DEMO_SEQUENCE: SequenceStep[] = [
  { messageType: 'PD_STAKEHOLDER_BRIEF', delayMs: 72 * HOUR },   // Day 3
  { messageType: 'PD_DIRECT_ASK', delayMs: 144 * HOUR },          // Day 6
  { messageType: 'PD_CLOSING_FILE', delayMs: 240 * HOUR },       // Day 10
];

export class ProspectSchedulerService {
  static async scheduleSequence(prospect: Prospect): Promise<void> {
    const now = Date.now();

    for (const step of POST_DEMO_SEQUENCE) {
      const scheduledFor = new Date(now + step.delayMs);
      await this.scheduleJob(prospect, step.messageType, scheduledFor);
    }
  }

  static async scheduleJob(
    prospect: Prospect,
    messageType: ProspectMessageType,
    scheduledFor: Date
  ): Promise<ProspectScheduledJob> {
    console.log(
      `[PROSPECT-SCHEDULER] Scheduling ${messageType} for ${prospect.email} at ${scheduledFor.toISOString()}`
    );

    return prospectDb.jobs.upsert({
      prospect_id: prospect.id,
      message_type: messageType,
      scheduled_for: scheduledFor.toISOString(),
      executed: false,
      cancelled: false,
    });
  }

  static async cancelAllJobs(prospectId: string): Promise<void> {
    await prospectDb.jobs.cancel(prospectId);
  }

  static async cancelJobTypes(
    prospectId: string,
    messageTypes: ProspectMessageType[]
  ): Promise<void> {
    await prospectDb.jobs.cancel(prospectId, messageTypes);
  }
}
