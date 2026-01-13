/**
 * SMS Templates
 * Short, punchy, action-focused
 * Max 160 chars for single SMS
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
        body: `${firstName}, you're booked with Elystra!\n${date} at ${time}.\nI'll send you a reminder before we connect.`,
      }),
      SMS_REMINDER: () => ({
        body: `${firstName}, quick reminder: Elystra demo at ${time}.\nGoal: compress 'send it over → paid' into same-day.\nYou still good for ${time}?`,
      }),
      SMS_JOIN_LINK: () => ({
        body: `${firstName}, I'm ready on the Elystra demo.\nJoin here: ${demo.join_url}`,
      }),
      SMS_URGENT: () => ({
        body: `${firstName}, I'm on the call now.\nIf you're running behind, text me a better time.\nOtherwise, hop in here: ${demo.join_url}`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}

