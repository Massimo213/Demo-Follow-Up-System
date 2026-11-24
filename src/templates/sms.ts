/**
 * SMS Templates v3
 * Commitment ladder system. Reschedule link only on same-day touches (30-min + urgent).
 * No consequence threats. No "infrastructural review." Clear, light language.
 * Asset frame mutates. No emojis.
 */

import type { Demo, MessageType } from '@/types/demo';
import { getRescheduleUrl } from '@/lib/urls';
import { painReplyForSms } from '@/lib/pain-reply';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface SmsTemplate {
  body: string;
}

function formatShortTime(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'h:mm a');
}

/** GSM-7 single segment. A second segment can split a URL on some phones. */
const SMS_SINGLE_SEGMENT = 160;

/**
 * T-30m text. Join URL always. Reschedule only when both fit in one segment.
 * The room link is the attendance action; the escape hatch already exists on the T-10m email.
 */
export function buildThirtyMinuteSms(joinUrl: string, rescheduleUrl: string): string {
  const lead = 'Your Elystra walkthrough starts in 30 minutes.';
  const join = joinUrl.trim();
  if (!join) {
    return `${lead} Need to reschedule? ${rescheduleUrl}`;
  }
  const withBoth = `${lead} Join here: ${join}. Need to reschedule? ${rescheduleUrl}`;
  if (withBoth.length <= SMS_SINGLE_SEGMENT) return withBoth;
  return `${lead} Join here: ${join}`;
}

function formatDayAtTime(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, "EEEE 'at' h:mm a");
}

export class SmsTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): SmsTemplate | null {
    const firstName = demo.name.split(' ')[0];
    const time = formatShortTime(demo);
    const when = formatDayAtTime(demo);
    const reply = painReplyForSms(demo);
    const rescheduleUrl = getRescheduleUrl();

    const templates: Partial<Record<MessageType, () => SmsTemplate>> = {
      /**
       * SMS_CONFIRM — fires immediately (if SMS path chosen)
       * No reschedule link. Asks which number matters.
       */
      SMS_CONFIRM: () => ({
        body: `${firstName} — ${when} is locked. One thing before we start: what would you fix first in how your agency closes deals? Reply here and I'll build the call around it.`,
      }),

      /**
       * SMS_DAY_BEFORE — T-24h (FUTURE sequence)
       * Ladder step 2: re-asks if they didn't answer, deepens if they did.
       * No reschedule link — a day out, no same-day conflict exists yet.
       */
      SMS_DAY_BEFORE: () => {
        const body = reply
          ? `${firstName} — tomorrow at ${time}.

You said ${reply} — built the call around it. See you then.`
          : `${firstName} — we're on tomorrow at ${time}.

Most agencies say the same thing — deals die between proposal and payment. If yours is different, reply and I'll adjust. Otherwise I'm starting there.`;
        return { body };
      },

      /**
       * CONFIRM_REMINDER — T-4h (NEXT_DAY sequence, SMS variant)
       * No reschedule link — 4 hours out, no same-day conflict yet.
       */
      CONFIRM_REMINDER: () => {
        const body = reply
          ? `${firstName}, we're on today at ${time}.

You said ${reply} — that's where we're starting.`
          : `${firstName}, we're on today at ${time}.

Most agencies say deals stall after the proposal — if yours is different let me know and I'll adjust. Otherwise that's where we start.`;
        return { body };
      },

      /**
       * EVENING_BEFORE — evening before demo
       * No reschedule link.
       */
      EVENING_BEFORE: () => {
        const body = reply
          ? `${firstName}, heads up — we're on tomorrow at ${time}.

You said ${reply}. I'll have something specific for you on that.`
          : `${firstName}, heads up — we're on tomorrow at ${time}.

Most agencies say deals die between proposal and payment. If yours is different, reply and I'll adjust.`;
        return { body };
      },

      /**
       * SMS_REMINDER — T-30min (all sequences)
       * Room link is the action. Reschedule stays only if the text fits in one SMS segment.
       */
      SMS_REMINDER: () => ({
        body: buildThirtyMinuteSms(demo.join_url, rescheduleUrl),
      }),

      /**
       * SMS_URGENT — if they haven't joined
       * Reschedule present. No "close the file" threat.
       */
      SMS_URGENT: () => ({
        body: `${firstName}, I'm on — ready when you are.

Join: ${demo.join_url}

If timing broke: ${rescheduleUrl}`,
      }),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }
}
