/**
 * Prospect Scheduler Service
 * 4-touch kill-or-close sequence in 10 days.
 *
 * T+30min: PD_RECAP_ROI         — recap, Elystra delta, $1.5K, guarantee, reply "Go"
 * T+48h:   PD_STAKEHOLDER_BRIEF — internal politics, forward template, agency proposal link
 * T+5d:    PD_DIRECT_ASK        — binary: implement or close file
 * T+10d:   PD_CLOSING_FILE      — final: 48h or close
 */

import { prospectDb } from '@/lib/prospect-db';
import type { Prospect, ProspectMessageType, ProspectScheduledJob } from '@/types/prospect';

const HOUR = 60 * 60 * 1000;

type SequenceStep = {
  messageType: ProspectMessageType;
  delayMs: number;
};

const POST_DEMO_SEQUENCE: SequenceStep[] = [
  { messageType: 'PD_RECAP_ROI', delayMs: 30 * 60 * 1000 },   // T+30min
  { messageType: 'PD_STAKEHOLDER_BRIEF', delayMs: 48 * HOUR }, // T+48h
  { messageType: 'PD_DIRECT_ASK', delayMs: 5 * 24 * HOUR },     // T+5d
  { messageType: 'PD_CLOSING_FILE', delayMs: 10 * 24 * HOUR },  // T+10d
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
