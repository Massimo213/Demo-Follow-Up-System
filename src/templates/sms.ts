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

    const templates: Partial<Record<MessageType, () => SmsTemplate>> = {
      SMS_REMINDER: () => ({
        body: `Hey ${firstName}, quick reminder: our demo with Elystra is today at ${time}. Talk soon!`,
      }),
      SMS_JOIN_LINK: () => ({
        body: `${firstName} - Ready when you are! Join here: ${demo.join_url}`,
      }),
      SMS_URGENT: () => ({
        body: `${firstName} - I'm on the call. Join now: ${demo.join_url}`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}

