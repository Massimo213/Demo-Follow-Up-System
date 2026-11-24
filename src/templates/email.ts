/**
 * Email Templates v3
 * Commitment ladder system. Reschedule link only on same-day touches.
 * No consequence threats. No "infrastructural review." Clear, light, showable-up-to.
 * Asset line mutates each touch.
 */

import type { Demo, MessageType } from '@/types/demo';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { wrapEmailHtmlClean } from '@/lib/email-signature';
import { getRescheduleUrl } from '@/lib/urls';
import { painReply } from '@/lib/pain-reply';

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function preDemoAssetUrl(): string {
  return process.env.PRE_DEMO_ASSET_URL || 'https://app.elystra.online/pre-demo';
}

function said(demo: Demo): string | null {
  return painReply(demo);
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
      subject: `${firstName} — ${time}`,
      html: wrapEmailHtmlClean(`
<p>Hey ${firstName},</p>

<p><strong>${time}</strong> is locked for your 7-minute walkthrough.</p>

<p>Quick one before we start — what's the one thing in your sales process you'd fix tomorrow if you could?</p>

<p>Reply with it and I'll build the walkthrough around it.</p>

<p>Here's a 90-second look at what we cover: <a href="${assetUrl}">${assetUrl}</a></p>

<p>See you ${day}.</p>

<p>David</p>
      `),
      text: `Hey ${firstName},

${time} is locked for your 7-minute walkthrough.

Quick one before we start — what's the one thing in your sales process you'd fix tomorrow if you could?

Reply with it and I'll build the walkthrough around it.

Here's a 90-second look at what we cover: ${assetUrl}

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

    const reply = said(demo);
    const bodyHtml = reply
      ? `<p>You said <strong>${escapeHtml(reply)}</strong> — I've built the walkthrough around it.</p>

<p>Here's a 90-second look at the shape of it: <a href="${assetUrl}">${assetUrl}</a></p>`
      : `<p>Most agencies your size say the same thing — deals stall somewhere between the proposal going out and the payment landing. If yours is different, reply and I'll adjust. Otherwise that's where I'm starting.</p>

<p>Here's a 90-second look if you haven't seen it: <a href="${assetUrl}">${assetUrl}</a></p>`;

    const bodyText = reply
      ? `You said ${reply} — I've built the walkthrough around it.

Here's a 90-second look at the shape of it: ${assetUrl}`
      : `Most agencies your size say the same thing — deals stall somewhere between the proposal going out and the payment landing. If yours is different, reply and I'll adjust. Otherwise that's where I'm starting.

Here's a 90-second look if you haven't seen it: ${assetUrl}`;

    return {
      subject: `${firstName} — today at ${time}`,
      html: wrapEmailHtmlClean(`
<p>${firstName},</p>

<p>We're on for <strong>${time} today</strong>.</p>

${bodyHtml}

<p>See you at ${time}.</p>

<p>David</p>
      `),
      text: `${firstName},

We're on for ${time} today.

${bodyText}

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

    const reply = said(demo);
    const proof = reply
      ? `One agency on this flow pulled $104K in overdue invoices within 48 hours — not from hiring or extra spend, just from taking control of the part where money usually slips.`
      : `One agency on this flow pulled $104K in overdue invoices within 48 hours — not from hiring or extra spend, just from taking control of the part where money slips between proposal and payment.`;

    const followHtml = reply
      ? `<p>You said <strong>${escapeHtml(reply)}</strong> — that's where we're starting, with your numbers.</p>

<p>If you haven't seen it: <a href="${assetUrl}">${assetUrl}</a></p>`
      : `<p>If you haven't seen it: <a href="${assetUrl}">${assetUrl}</a></p>`;

    const followText = reply
      ? `You said ${reply} — that's where we're starting, with your numbers.

If you haven't seen it: ${assetUrl}`
      : `If you haven't seen it: ${assetUrl}`;

    return {
      subject: `${firstName} — before ${time}`,
      html: wrapEmailHtmlClean(`
<p>${firstName},</p>

<p>Before <strong>${time}</strong>:</p>

<p>${proof}</p>

${followHtml}

<p>See you at ${time}.</p>

<p>David</p>
      `),
      text: `${firstName},

Before ${time}:

${proof}

${followText}

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

    const reply = said(demo);
    const openHtml = reply
      ? `<p>You said <strong>${escapeHtml(reply)}</strong> — that's where we're starting.</p>`
      : `<p>Most agencies lose the deal somewhere between the proposal going out and the money coming in — if yours is different, tell me when you join. Otherwise that's where I'm starting.</p>`;
    const openText = reply
      ? `You said ${reply} — that's where we're starting.`
      : `Most agencies lose the deal somewhere between the proposal going out and the money coming in — if yours is different, tell me when you join. Otherwise that's where I'm starting.`;

    return {
      subject: `Starting now — your 7-minute walkthrough`,
      html: wrapEmailHtmlClean(`
<p>${firstName},</p>

<p>I'm ready.</p>

${openHtml}

<p><a href="${demo.join_url}" class="cta">Join Walkthrough</a></p>

<p>Or copy this link:<br>
<span class="muted">${demo.join_url}</span></p>

<p>If timing just broke: <a href="${rescheduleUrl}">Reschedule</a></p>

<p>David</p>
      `),
      text: `${firstName},

I'm ready.

${openText}

Join: ${demo.join_url}

If timing just broke: ${rescheduleUrl}

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

    const reply = said(demo);
    const metricLine = reply
      ? `<p>You said <strong>${escapeHtml(reply)}</strong> — still worth 7 minutes to see how that gets fixed?</p>`
      : `<p>Still worth 7 minutes to look at where deals stall between the proposal and the payment?</p>`;

    const metricLineText = reply
      ? `You said ${reply} — still worth 7 minutes to see how that gets fixed?`
      : `Still worth 7 minutes to look at where deals stall between the proposal and the payment?`;

    return {
      subject: `Missed you, ${firstName} — want to grab another?`,
      html: wrapEmailHtmlClean(`
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
