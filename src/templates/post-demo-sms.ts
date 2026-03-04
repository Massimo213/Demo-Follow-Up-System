/**
 * Post-Demo SMS Templates
 * Currently unused — 4-touch sequence is email-only.
 * Kept as a placeholder for future SMS touches.
 */

import type { Prospect, ProspectMessageType } from '@/types/prospect';

interface SmsTemplate {
  body: string;
}

export class PostDemoSmsTemplates {
  static getTemplate(
    _messageType: ProspectMessageType,
    _prospect: Prospect
  ): SmsTemplate | null {
    return null;
  }
}
