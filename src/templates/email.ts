/**
 * Email Templates v3
 * Commitment ladder system. Reschedule link only on same-day touches.
 * No consequence threats. No "infrastructural review." Clear, light, showable-up-to.
 * Asset line mutates each touch.
 */

import type { Demo, MessageType } from '@/types/demo';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { wrapEmailHtml } from '@/lib/email-signature';
import { getRescheduleUrl } from '@/lib/urls';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function formatDemoTime(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, "EEEE, MMMM d 'at' h:mm a");
}

function formatShortTime(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'h:mm a');
}

function formatDay(demo: Demo): string {
  const demoDate = toZonedTime(new Date(demo.scheduled_at), demo.timezone);
  return format(demoDate, 'EEEE');
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

export class EmailTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): EmailTemplate | null {
    const templates: Partial<Record<MessageType, () => EmailTemplate>> = {
      CONFIRM_INITIAL: () => this.confirmInitial(demo),
      CONFIRM_INITIAL_LOOM: () => this.confirmInitial(demo),
      CONFIRM_REMINDER: () => this.confirmReminder(demo),
      DAY_OF_REMINDER: () => this.valueBomb(demo),
      VALUE_BOMB: () => this.valueBomb(demo),
      JOIN_LINK: () => this.joinLink(demo),
      POST_NO_SHOW: () => this.postNoShow(demo),
      JOIN_URGENT: () => this.joinLink(demo),
      SOONER_OFFER: () => this.valueBomb(demo),
      RECEIPT: () => this.confirmInitial(demo),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }

  /**
   * CONFIRMATION LOCK — fires immediately
   * Ladder step 1: asks prospect to pick a number (first investment)
   * Scarcity stated once. No reschedule link. Asset introduced fresh.
   */
  static confirmInitial(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const day = formatDay(demo);
    const firstName = demo.name.split(' ')[0];
    const assetUrl = preDemoAssetUrl();

    return {
      subject: `Locked: your 7-minute Elystra walkthrough — ${time}`,
      html: wrapEmailHtml(`
<p>Hey ${firstName},</p>

<p><strong>${time}</strong> is locked for your 7-minute walkthrough.</p>

<p>We keep these short abd focused — so one quick thing: <strong>what's the number you most want to move : close rate, average deal size, or total revenue collected per month?</strong></p>

<p>Reply with one and I'll build the walkthrough around it.</p>

<p>Here's a 90-second look at what we'll be talking about: <a href="${assetUrl}">${assetUrl}</a></p>

<p>See you ${day}.</p>

<p>David</p>
      `),
      text: `Hey ${firstName},

${time} is locked for your 7-minute walkthrough.

We keep these short and focused — so one quick thing: what's the number you most want to move : close rate, average deal size, or total revenue collected per month?

Reply with one and I'll build the walkthrough around it.

Here's a 90-second look at what we'll be talking about: ${assetUrl}

See you ${day}.

David`,
    };
  }

  /**
   * CONFIRM REMINDER — T-4h for NEXT_DAY bookings
   * Ladder step: references their metric if given, or asks again
   * No reschedule link — 4 hours out on a next-day booking, no same-day conflict yet.
   */
  static confirmReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];
    const assetUrl = preDemoAssetUrl();

    const metricLine = hasFocusMetric(demo)
      ? `<p>You mentioned <strong>${getFocusMetricText(demo)}</strong> was the one you wanted to move — that's exactly where I'll start.</p>`
      : `<p>Come with your rough monthly proposal count in mind — that's where we'll start.</p>`;

    const metricLineText = hasFocusMetric(demo)
      ? `You mentioned ${getFocusMetricText(demo)} was the one you wanted to move — that's exactly where I'll start.`
      : `Come with your rough monthly proposal count in mind — that's where we'll start.`;

    return {
      subject: `${firstName} — today at ${time}`,
      html: wrapEmailHtml(`
<p>${firstName},</p>

<p>We're on for <strong>${time} today</strong>.</p>

<p>If you haven't looked yet, this shows you the shape of what we'll cover: <a href="${assetUrl}">${assetUrl}</a></p>

${metricLine}

<p>See you at ${time}.</p>

<p>David</p>
      `),
      text: `${firstName},

We're on for ${time} today.

If you haven't looked yet, this shows you the shape of what we'll cover: ${assetUrl}

${metricLineText}

See you at ${time}.

David`,
    };
  }

  /**
   * VALUE TOUCH — T-4h for FUTURE bookings
   * Ladder step 3: references THEIR number back to them — they're now invested
   * Asset reframed. No reschedule link — 4 hours out, conflict window hasn't opened.
   */
  static valueBomb(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];
    const assetUrl = preDemoAssetUrl();

    const metricLine = hasFocusMetric(demo)
      ? `<p>You told me <strong>${getFocusMetricText(demo)}</strong> was the one you wanted to move — that's exactly where I'll start.</p>`
      : `<p>Come with your rough monthly proposal count in mind — that's where we'll start.</p>`;

    const metricLineText = hasFocusMetric(demo)
      ? `You told me ${getFocusMetricText(demo)} was the one you wanted to move — that's exactly where I'll start.`
      : `Come with your rough monthly proposal count in mind — that's where we'll start.`;

    return {
      subject: `${firstName} — one number before ${time}`,
      html: wrapEmailHtml(`
<p>${firstName},</p>

<p>Before we talk at <strong>${time}</strong>:</p>

<p>One agency on this flow pulled $104K in overdue invoices within 48 hours — not from hiring or spend, just from taking control of the part of the deal where money usually slips.</p>

<p>If you haven't looked yet, this shows you the shape of it: <a href="${assetUrl}">${assetUrl}</a></p>

${metricLine}

<p>See you at ${time}.</p>

<p>David</p>
      `),
      text: `${firstName},

Before we talk at ${time}:

One agency on this flow pulled $104K in overdue invoices within 48 hours — not from hiring or spend, just from taking control of the part of the deal where money usually slips.

If you haven't looked yet, this shows you the shape of it: ${assetUrl}

${metricLineText}

See you at ${time}.

David`,
    };
  }

  /**
   * JOIN LINK — T-10m
   * References their number one final time — peak investment at moment of attendance.
   * Reschedule present — same-day, real conflict possible. No threat.
   */
  static joinLink(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];
    const rescheduleUrl = getRescheduleUrl();

    const metricLine = hasFocusMetric(demo)
      ? `<p>We'll start with <strong>${getFocusMetricText(demo)}</strong> — where it's leaking and what closes the gap.</p>`
      : `<p>We'll look at where your sales motion is leaking and what closes the gap.</p>`;

    const metricLineText = hasFocusMetric(demo)
      ? `We'll start with ${getFocusMetricText(demo)} — where it's leaking and what closes the gap.`
      : `We'll look at where your sales motion is leaking and what closes the gap.`;

    return {
      subject: `Starting now — your 7-minute walkthrough`,
      html: wrapEmailHtml(`
<p>${firstName},</p>

<p>I'm ready.</p>

${metricLine}

<p><a href="${demo.join_url}" class="cta">Join Walkthrough</a></p>

<p>Or copy this link:<br>
<span class="muted">${demo.join_url}</span></p>

<p>If timing just broke on your side: <a href="${rescheduleUrl}">Reschedule</a></p>

<p>David</p>
      `),
      text: `${firstName},

I'm ready.

${metricLineText}

Join: ${demo.join_url}

If timing just broke on your side: ${rescheduleUrl}

David`,
    };
  }

  /**
   * POST NO-SHOW — if they miss
   * Uses their number as the reactivation hook — the investment they made is the reason to rebook.
   * No threats. Warm, open, their-stake-forward.
   */
  static postNoShow(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];
    const rescheduleUrl = getRescheduleUrl();

    const metricLine = hasFocusMetric(demo)
      ? `<p>You'd mentioned <strong>${getFocusMetricText(demo)}</strong> was the one you wanted to move — still worth 7 minutes to see how that gets fixed?</p>`
      : `<p>Still worth 7 minutes to see where your sales motion is leaking and how to fix it?</p>`;

    const metricLineText = hasFocusMetric(demo)
      ? `You'd mentioned ${getFocusMetricText(demo)} was the one you wanted to move — still worth 7 minutes to see how that gets fixed?`
      : `Still worth 7 minutes to see where your sales motion is leaking and how to fix it?`;

    return {
      subject: `Missed you, ${firstName} — want to grab another?`,
      html: wrapEmailHtml(`
<p>${firstName},</p>

<p>We missed each other. Happens to everyone.</p>

${metricLine}

<p><a href="${rescheduleUrl}" class="cta">Grab a time</a></p>

<p>David</p>
      `),
      text: `${firstName},

We missed each other. Happens to everyone.

${metricLineText}

Grab a time: ${rescheduleUrl}

David`,
    };
  }
}
