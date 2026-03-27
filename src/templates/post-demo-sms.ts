/**
 * Post-Demo SMS Templates
 * Short, operational, decision-focused.
 */

import type { Prospect, ProspectMessageType } from '@/types/prospect';

interface SmsTemplate {
  body: string;
}

export class PostDemoSmsTemplates {
  static getTemplate(
    messageType: ProspectMessageType,
    prospect: Prospect
  ): SmsTemplate | null {
    const name = prospect.name.split(' ')[0];

    const templates: Partial<Record<ProspectMessageType, SmsTemplate>> = {
      PD_SMS_ASSESSMENT_WORKSPACE: {
        body: `Hi ${name} — just sent over the Revenue Infrastructure Assessment + your private Elystra evaluation workspace. Review both on your side, and if another walkthrough is needed, send me 2 times that work. — Massimo`,
      },
      PD_SMS_MISSED_CALL: {
        body: `Tried you quickly just now. Main thing I wanted to understand is whether this is moving through internal review, another walkthrough, or should be left there cleanly.`,
      },
      PD_SMS_DECISION: {
        body: `Hi ${name}, you've had the assessment and the private workspace on your side, and we've tried to understand what is blocking movement. If there is a blocker, send it directly. If another review is needed, send 2 times that work and we'll keep it focused. — Massimo`,
      },
    };

    return templates[messageType] || null;
  }
}
