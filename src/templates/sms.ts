/**
 * SMS Templates v2
 * Binary commitment. Consequence where scheduled.
 * No emojis. No fluff.
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
        body: `${firstName}, it's David from Elystra.\nYou're locked for ${date} at ${time}.\nThis is the 7-minute review where we see whether Elystra can give your agency a real shot at breaking the 10-30% close-rate cycle and moving toward 50%+ close rates within six weeks with a stronger sales motion.\nReply YES to confirm, or R to reschedule.`,
      }),

      SMS_REMINDER: () => ({
        body: `${firstName}, we're on in 30 minutes for your Elystra walkthrough.\nThis is the review where we see whether your agency has a real shot at a stronger sales motion with more control and better close potential.\nIf timing broke on your side, text R now and we'll move it cleanly.`,
      }),

      CONFIRM_REMINDER: () => ({
        body: `${firstName}, we're on today at ${time} for your 7-minute Elystra walkthrough. Reply YES to confirm, or R to reschedule.`,
      }),

      EVENING_BEFORE: () => ({
        body: `${firstName}, heads up, we're on tomorrow at ${time} for your 7-minute Elystra walkthrough.\nReply YES to confirm, or R to move it. No reply by morning = I release the slot.`,
      }),

      SMS_DAY_BEFORE: () => ({
        body: `${firstName}, quick heads-up for tomorrow at ${time}.\nWe're still on for your 7-minute Elystra walkthrough.\nThis is the review where we see whether your agency has a real shot at a cleaner, faster, more controlled sales motion.\nReply YES to confirm, or R to move it.`,
      }),

      SMS_URGENT: () => ({
        body: `${firstName}, I've been on for a few minutes.\n(A) Reschedule this properly or (B) close the file?\nReply A or B.`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}
