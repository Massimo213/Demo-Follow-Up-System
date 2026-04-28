/**
 * Post-Demo SMS Templates
 * SMS does not replace the Day-0 manual email - it points to it and asks for one next move.
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
        body: `Hi ${name}, Revenue Infrastructure Assessment + private Elystra evaluation workspace are in your email now - assessment = business case, workspace = live proof (48h once activated). Full detail is in that email; need another walkthrough? Reply with 2 times that work. David, Elystra`,
      },
      PD_SMS_STAKEHOLDER_FOLLOWUP: {
        body: `Hi ${name}, I just sent you a direct email.

Wanted to understand where this currently stands on your side. Have you had the chance to review? If you have, the only thing I really need to know is whether you want to activate, whether there is a blocker, or whether one more walkthrough would help move this forward.`,
      },
      PD_SMS_DECISION: {
        body: `Hi ${name}, need one move on Elystra: reply ACTIVATE (I send checkout), one-line BLOCKER, or PASS and I close the file - David from Elystra`,
      },
    };

    return templates[messageType] || null;
  }
}
