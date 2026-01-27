/**
 * SMS Templates
 * Binary commitment focused - every message demands YES/R/A/B
 * No soft language, no optional responses
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
        body: `${firstName}, it's the Elystra team.\nI've blocked ${date} ${time} to map your proposals → cash rail in your 7-Minute Elystra Walkthrough.\nReply YES to lock this slot, or R if we should reschedule and pick another time.`,
      }),
      SMS_REMINDER: () => ({
        body: `${firstName}, we're on for ${time} for your 7-Minute Elystra Walkthrough. I'll walk you through how agencies are pulling extra deals just from follow-up + payment rail.\nIf anything broke on your side, text R now so I don't sit on Zoom alone :)`,
      }),
      SMS_JOIN_LINK: () => ({
        body: `${firstName}, I'm ready on the Elystra demo now.\nJoin: ${demo.join_url}\nIf you're stuck in another call, reply R and we'll reschedule instead of you ghosting.`,
      }),
      SMS_URGENT: () => ({
        body: `${firstName}, I've been on for a few minutes.\nDo you want to (A) reschedule this properly or (B) close the file for now?\nReply A or B.`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}

