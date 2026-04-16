/**
 * SMS Templates v2
 * Binary commitment. Consequence where scheduled. Infrastructure frame (infrastructural review).
 * Every message demands YES / R / A / B. No emojis.
 */

import type { Demo, MessageType } from '@/types/demo';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface SmsTemplate {
  body: string;
}

function formatShortTime(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'h:mm a');
}

function formatShortDate(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'EEE M/d');
}

export class SmsTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): SmsTemplate | null {
    const firstName = demo.name.split(' ')[0];
    const time = formatShortTime(demo);
    const date = formatShortDate(demo);

    const templates: Partial<Record<MessageType, () => SmsTemplate>> = {
      SMS_CONFIRM: () => ({
        body: `${firstName}, it's David from Elystra.\n${date} at ${time} - your 7-minute infrastructural review is locked.\n170+ agencies leaked money after interest existed; Elystra controls that layer. 7 min to see if it sits under your motion.\nReply YES to confirm, or R to reschedule.`,
      }),

      SMS_REMINDER: () => ({
        body: `${firstName}, we're on in 30 minutes. Infrastructural review of your motion after buyer interest, not a product tour.\nIf something came up, text R now so I can release the slot to someone on the waitlist.`,
      }),

      CONFIRM_REMINDER: () => ({
        body: `${firstName}, we're on today at ${time} for your 7-minute Elystra infrastructural review. Reply YES to confirm, or R to reschedule.`,
      }),

      EVENING_BEFORE: () => ({
        body: `${firstName}, heads up - we're on tomorrow at ${time} for your 7-minute infrastructural review.\nReply YES to confirm, or R to move it. No reply by morning = I release the slot.`,
      }),

      SMS_DAY_BEFORE: () => ({
        body: `${firstName}, tomorrow at ${time} - your 7-minute infrastructural review.\nReply YES to confirm, or R to move it. No reply by tonight = slot gets released.`,
      }),

      SMS_URGENT: () => ({
        body: `${firstName}, I've been on for a few minutes.\n(A) Reschedule this properly or (B) close the file?\nReply A or B.`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}
