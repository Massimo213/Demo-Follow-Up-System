/**
 * Prospect Scheduler Service
 * 6-day post-demo OS — single objective: paid activation or clean, explicit exit.
 *
 * Founder/manual: Day 0 recap+assessment+workspace, Day 2 call, optional Day 5 call.
 * Automated touches (all ladder to close / name blocker / close file):
 * - Day 0: PD_SMS_ASSESSMENT_WORKSPACE — shortly after manual Day-0 email; inbox pointer only
 * - Day 1: PD_STAKEHOLDER_BRIEF (email)
 * - Day 2: PD_INTERNAL_CALL_REMINDER (email to team)
 * - Day 3: PD_DIRECT_ASK
 * - Day 4: PD_SMS_DECISION
 * - Day 6: PD_CLOSING_FILE
 */

import { prospectDb } from '@/lib/prospect-db';
import type { Prospect, ProspectMessageType, ProspectScheduledJob } from '@/types/prospect';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

type SequenceStep = {
  messageType: ProspectMessageType;
  delayMs: number;
};

const POST_DEMO_SEQUENCE: SequenceStep[] = [
  { messageType: 'PD_SMS_ASSESSMENT_WORKSPACE', delayMs: 15 * MINUTE }, // Day 0: receipt nudge after manual send + prospect logged
  { messageType: 'PD_STAKEHOLDER_BRIEF', delayMs: 24 * HOUR },          // Day 1
  { messageType: 'PD_INTERNAL_CALL_REMINDER', delayMs: 48 * HOUR },     // Day 2
  { messageType: 'PD_DIRECT_ASK', delayMs: 72 * HOUR },                 // Day 3
  { messageType: 'PD_SMS_DECISION', delayMs: 96 * HOUR },               // Day 4
  { messageType: 'PD_CLOSING_FILE', delayMs: 144 * HOUR },              // Day 6
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
