/**
 * SMS Templates v3
 * Commitment ladder system. Reschedule link only on same-day touches (30-min + urgent).
 * No consequence threats. No "infrastructural review." Clear, light language.
 * Asset frame mutates. No emojis.
 */

import type { Demo, MessageType } from '@/types/demo';
import { getRescheduleUrl } from '@/lib/urls';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface SmsTemplate {
  body: string;
}

function formatShortTime(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'h:mm a');
}

function preDemoAssetUrl(): string {
  return process.env.PRE_DEMO_ASSET_URL || 'https://app.elystra.online/pre-demo';
}

function getFocusMetricText(demo: Demo): string {
  const metricMap: Record<string, string> = {
    close_rate: 'close rate',
    deal_size: 'deal size',
    follow_up: 'follow-up',
  };
  return demo.focus_metric ? metricMap[demo.focus_metric] || 'your numbers' : 'your numbers';
}

function hasFocusMetric(demo: Demo): boolean {
  return !!demo.focus_metric;
}

export class SmsTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): SmsTemplate | null {
    const firstName = demo.name.split(' ')[0];
    const time = formatShortTime(demo);
    const assetUrl = preDemoAssetUrl();
    const rescheduleUrl = getRescheduleUrl();

    const templates: Partial<Record<MessageType, () => SmsTemplate>> = {
      /**
       * SMS_CONFIRM — fires immediately (if SMS path chosen)
       * No reschedule link. Asks which number matters.
       */
      SMS_CONFIRM: () => ({
        body: `${firstName}, it's David from Elystra.

Your 7-minute walkthrough is locked for ${time}.

Quick question: what's the one number you'd most want to move — close rate, deal size, or total revenue collected per month? Reply with one and I'll build the call around it.`,
      }),

      /**
       * SMS_DAY_BEFORE — T-24h (FUTURE sequence)
       * Ladder step 2: re-asks if they didn't answer, deepens if they did.
       * No reschedule link — a day out, no same-day conflict exists yet.
       */
      SMS_DAY_BEFORE: () => {
        const body = hasFocusMetric(demo)
          ? `${firstName} — we're on tomorrow at ${time}.

You mentioned ${getFocusMetricText(demo)} — that's where I'll start. See you then.`
          : `${firstName} — we're on tomorrow at ${time}.

Did one of those three hit — close rate, deal size, or follow-up? Reply with the one that stings most and I'll make sure we cover it.`;
        return { body };
      },

      /**
       * CONFIRM_REMINDER — T-4h (NEXT_DAY sequence, SMS variant)
       * No reschedule link — 4 hours out, no same-day conflict yet.
       */
      CONFIRM_REMINDER: () => {
        const body = hasFocusMetric(demo)
          ? `${firstName}, we're on today at ${time}.

You said ${getFocusMetricText(demo)} — that's exactly where we'll start.`
          : `${firstName}, we're on today at ${time} for your 7-minute walkthrough.

Quick question before we hop on: close rate, deal size, or total revenue collected per month — which one stings most?`;
        return { body };
      },

      /**
       * EVENING_BEFORE — evening before demo
       * No reschedule link.
       */
      EVENING_BEFORE: () => {
        const body = hasFocusMetric(demo)
          ? `${firstName}, heads up — we're on tomorrow at ${time}.

You mentioned ${getFocusMetricText(demo)}. I'll have something specific for you on that.`
          : `${firstName}, heads up — we're on tomorrow at ${time} for your 7-minute walkthrough.

If you haven't yet: close rate, deal size, or follow-up — which one matters most? Reply and I'll build around it.`;
        return { body };
      },

      /**
       * SMS_REMINDER — T-30min (all sequences)
       * Reschedule link APPEARS here — first time. Real same-day conflict can exist.
       * Asset becomes a direct prompt.
       */
      SMS_REMINDER: () => ({
        body: `${firstName} — 30 minutes out.

If you haven't opened this yet, open it now — it's 90 seconds and it'll make the call land faster: ${assetUrl}

Something blow up last minute? ${rescheduleUrl}`,
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
