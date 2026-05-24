/**
 * SMS Templates v2
 * Binary commitment. Consequence where scheduled. Infrastructure frame (infrastructural review).
 * Every message demands YES + a Reschedule link. No emojis.
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

function preDemoAssetUrl(): string {
  return process.env.PRE_DEMO_ASSET_URL || 'https://app.elystra.online/pre-demo';
}

function preDemoAssetText(): string {
  return `Before we hop on — this is 10% of what Elystra does.\nPre-demo assets: ${preDemoAssetUrl()}`;
}

function preDemoAssetSms(): string {
  return `\n${preDemoAssetText()}`;
}

function preDemoAssetSmsUrgent(): string {
  return `\nIf you haven't opened the pre-demo assets yet, open them now:\n${preDemoAssetUrl()}`;
}

function rescheduleUrl(): string {
  return process.env.RESCHEDULE_URL || 'https://www.elystra.online/reschedule';
}

function confirmSmsActions(): string {
  return `\nReply YES to confirm.\nReschedule: ${rescheduleUrl()}`;
}

function rescheduleSmsPrompt(): string {
  return `\nReschedule: ${rescheduleUrl()}`;
}

export class SmsTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): SmsTemplate | null {
    const firstName = demo.name.split(' ')[0];
    const time = formatShortTime(demo);
    const date = formatShortDate(demo);

    const templates: Partial<Record<MessageType, () => SmsTemplate>> = {
      SMS_CONFIRM: () => ({
        body: `${firstName}, it's David from Elystra.\n${date} at ${time} - your 7-minute infrastructural review is locked.\n7 min to see if it sits under your motion.${preDemoAssetSms()}${confirmSmsActions()}`,
      }),

      SMS_REMINDER: () => ({
        body: `${firstName}, we're on in 30 minutes. Infrastructural review of your motion after buyer interest, not a product tour.${preDemoAssetSmsUrgent()}${rescheduleSmsPrompt()}`,
      }),

      CONFIRM_REMINDER: () => ({
        body: `${firstName}, we're on today at ${time} for your 7-minute Elystra infrastructural review.${preDemoAssetSms()}${confirmSmsActions()}`,
      }),

      EVENING_BEFORE: () => ({
        body: `${firstName}, heads up - we're on tomorrow at ${time} for your 7-minute infrastructural review.${preDemoAssetSms()}${confirmSmsActions()}`,
      }),

      SMS_DAY_BEFORE: () => ({
        body: `${firstName}, tomorrow at ${time} - your 7-minute infrastructural review.${preDemoAssetSms()}${confirmSmsActions()}`,
      }),

      SMS_URGENT: () => ({
        body: `${firstName}, I've been on for a few minutes.${rescheduleSmsPrompt()}\nOr reply B to close the file.`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}
