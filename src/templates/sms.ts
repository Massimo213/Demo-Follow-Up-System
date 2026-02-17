/**
 * SMS Templates v2
 * Binary commitment. Passive aggression. Consequence-driven.
 * Every message has a job. Every message demands YES / R / A / B.
 * No emojis. No fluff. Artful pressure.
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

function formatDayOnly(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'EEEE');
}

export class SmsTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): SmsTemplate | null {
    const firstName = demo.name.split(' ')[0];
    const time = formatShortTime(demo);
    const date = formatShortDate(demo);
    const day = formatDayOnly(demo);

    const templates: Partial<Record<MessageType, () => SmsTemplate>> = {

      // Immediate: lock commitment, open channel
      SMS_CONFIRM: () => ({
        body: `${firstName}, it's David from Elystra.\n${date} at ${time} -- your 7-minute walkthrough is locked.\n166 agencies went from 45% to 66% close rate using this flow.\nReply YES to confirm, or R to reschedule.`,
      }),

      // T-30min: last check, scarcity
      SMS_REMINDER: () => ({
        body: `${firstName}, we're on in 30 minutes for your 7-minute Elystra walkthrough.\nIf something came up, text R now so I can release the slot to someone on the waitlist.`,
      }),

      // Evening before (NEXT_DAY only): gut-check
      EVENING_BEFORE: () => ({
        body: `${firstName}, heads up -- we're on tomorrow at ${time} for your 7-minute Elystra walkthrough.\nReply YES to confirm, or R to move it. No reply by morning = I release the slot.`,
      }),

      // T-24h (FUTURE only): day-before commitment
      SMS_DAY_BEFORE: () => ({
        body: `${firstName}, tomorrow at ${time} -- your 7-minute Elystra walkthrough.\nReply YES to confirm, or R to move it. No reply by tonight = slot gets released.`,
      }),

      // T+8min: no-show final decision
      SMS_URGENT: () => ({
        body: `${firstName}, I've been on for a few minutes.\n(A) Reschedule this properly or (B) close the file?\nReply A or B.`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}
