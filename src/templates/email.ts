/**
 * Email Templates v2
 * Consequence-driven. Pre-demo frame: sales infrastructure, show-up focus.
 * Every email demands YES / RESCHEDULE. No soft outs.
 * Signed: Best, David / Elystra
 */

import type { Demo, MessageType } from '@/types/demo';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
    .cta { display: inline-block; background: #0066ff; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .cta:hover { background: #0052cc; }
    .muted { color: #666; font-size: 14px; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

export class EmailTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): EmailTemplate | null {
    const templates: Partial<Record<MessageType, () => EmailTemplate>> = {
      CONFIRM_INITIAL: () => this.confirmInitial(demo),
      CONFIRM_INITIAL_LOOM: () => this.confirmInitialLoom(demo),
      CONFIRM_REMINDER: () => this.confirmReminder(demo),
      DAY_OF_REMINDER: () => this.dayOfReminder(demo),
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
   * CONFIRM_INITIAL: Immediate after booking
   */
  static confirmInitial(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Locked: 7-minute Elystra walkthrough - ${time}`,
      html: wrapHtml(`
<p>Hi ${firstName},</p>

<p>You're locked for <strong>${time}</strong>.</p>

<p>This is the 7-minute review where we look at one thing only:</p>

<p>whether Elystra can give your agency a real shot at breaking the 10-30% close-rate cycle and moving toward 50%+ close rates within six weeks by installing a cleaner, faster, more controlled sales motion.</p>

<p>We'll show you how 170 agency partners across Canada and the US use Elystra to tighten the part of the sales process where momentum usually weakens after interest exists.</p>

<p>We'll look at:</p>
<p>- where the current sales motion loses force</p>
<p>- how Elystra changes that motion operationally</p>
<p>- whether the system fits how your agency actually sells</p>

${demo.join_url ? `<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>` : ''}

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if you need a different time.</p>

<p>Best,<br>
David<br>
Elystra</p>
      `),
      text: `Hi ${firstName},

You're locked for ${time}.

This is the 7-minute review where we look at one thing only:

whether Elystra can give your agency a real shot at breaking the 10-30% close-rate cycle and moving toward 50%+ close rates within six weeks by installing a cleaner, faster, more controlled sales motion.

We'll show you how 170 agency partners across Canada and the US use Elystra to tighten the part of the sales process where momentum usually weakens after interest exists.

We'll look at:
- where the current sales motion loses force
- how Elystra changes that motion operationally
- whether the system fits how your agency actually sells

${demo.join_url ? `Join link: ${demo.join_url}` : ''}

Reply YES to confirm.

Reply RESCHEDULE if you need a different time.

Best,
David
Elystra`,
    };
  }

  /**
   * CONFIRM_INITIAL_LOOM: FUTURE demos, confirm with Loom intro video
   */
  static confirmInitialLoom(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];
    const loomUrl = process.env.LOOM_URL || 'https://www.loom.com/share/your-demo-intro';

    return {
      subject: `Locked: 7-minute Elystra walkthrough - ${time}`,
      html: wrapHtml(`
<p>Hi ${firstName},</p>

<p>You're locked for <strong>${time}</strong>.</p>

<p>Before we hop on, I recorded a quick 2-minute intro so you know exactly what to expect:</p>

<p><a href="${loomUrl}" class="cta">Watch the intro</a></p>

<p>This is the 7-minute review where we look at one thing only: whether Elystra can give your agency a real shot at breaking the 10-30% close-rate cycle and moving toward 50%+ close rates within six weeks by installing a cleaner, faster, more controlled sales motion.</p>

<p>We'll show you how 170 agency partners across Canada and the US use Elystra to tighten the part of the sales process where momentum usually weakens after interest exists.</p>

<p>We'll look at:</p>
<p>- where the current sales motion loses force</p>
<p>- how Elystra changes that motion operationally</p>
<p>- whether the system fits how your agency actually sells</p>

${demo.join_url ? `<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>` : ''}

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if you need a different time.</p>

<p>Best,<br>
David<br>
Elystra</p>
      `),
      text: `Hi ${firstName},

You're locked for ${time}.

Watch a 2-minute intro before we hop on: ${loomUrl}

This is the 7-minute review where we look at one thing only: whether Elystra can give your agency a real shot at breaking the 10-30% close-rate cycle and moving toward 50%+ close rates within six weeks by installing a cleaner, faster, more controlled sales motion.

We'll show you how 170 agency partners across Canada and the US use Elystra to tighten the part of the sales process where momentum usually weakens after interest exists.

We'll look at:
- where the current sales motion loses force
- how Elystra changes that motion operationally
- whether the system fits how your agency actually sells

${demo.join_url ? `Join link: ${demo.join_url}` : ''}

Reply YES to confirm.

Reply RESCHEDULE if you need a different time.

Best,
David
Elystra`,
    };
  }

  /**
   * CONFIRM_REMINDER: NEXT_DAY T-4h, day-of reminder email
   */
  static confirmReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} - today at ${time}`,
      html: wrapHtml(`
<p>Hi ${firstName},</p>

<p>We're on for <strong>${time} today</strong>.</p>

<p>This is not a generic walkthrough.</p>

<p>It is the 7-minute review where we look at whether Elystra can give your agency:</p>
<p>- a faster sales motion</p>
<p>- more control over live opportunities</p>
<p>- stronger follow-up after scope is out</p>
<p>- and a real shot at turning more pipeline into collected revenue</p>

<p>If the system fits, the gain is simple: less ghosting, less competitive slippage, less weak follow-up after scope is out, and a better shot at breaking the 10-30% cycle that keeps agencies stuck.</p>

<p><strong>Reply YES</strong> to hold the slot.</p>

<p><strong>Reply RESCHEDULE</strong> if something changed on your side.</p>

<p>Best,<br>
David<br>
Elystra</p>
      `),
      text: `Hi ${firstName},

We're on for ${time} today.

This is not a generic walkthrough.

It is the 7-minute review where we look at whether Elystra can give your agency:
- a faster sales motion
- more control over live opportunities
- stronger follow-up after scope is out
- and a real shot at turning more pipeline into collected revenue

If the system fits, the gain is simple: less ghosting, less competitive slippage, less weak follow-up after scope is out, and a better shot at breaking the 10-30% cycle that keeps agencies stuck.

Reply YES to hold the slot.

Reply RESCHEDULE if something changed on your side.

Best,
David
Elystra`,
    };
  }

  /**
   * DAY_OF_REMINDER: FUTURE T-4h, same day-of frame as NEXT_DAY
   */
  static dayOfReminder(demo: Demo): EmailTemplate {
    return this.confirmReminder(demo);
  }

  /**
   * VALUE_BOMB: legacy scheduled jobs
   */
  static valueBomb(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const day = formatDay(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Quick number before ${day}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Before our 7-minute walkthrough on <strong>${time}</strong>:</p>

<p>One agency using this exact flow pulled $14K in overdue invoices within 48 hours. Not by hiring. Not by scaling spend. Just by tightening the gap between proposal and payment.</p>

<p>170 agency partners across Canada and the US use Elystra to tighten the part of the sales process where momentum usually weakens after interest exists.</p>

<p>No ask, just wanted you to have context before we talk. See you ${day}.</p>

<p>Best,<br>
David<br>
Elystra</p>
      `),
      text: `${firstName},

Before our 7-minute walkthrough on ${time}:

One agency using this exact flow pulled $14K in overdue invoices within 48 hours. Not by hiring. Not by scaling spend. Just by tightening the gap between proposal and payment.

170 agency partners across Canada and the US use Elystra to tighten the part of the sales process where momentum usually weakens after interest exists.

No ask, just wanted you to have context before we talk. See you ${day}.

Best,
David
Elystra`,
    };
  }

  /**
   * JOIN_LINK: T-10min
   */
  static joinLink(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Join link - Elystra walkthrough starting now`,
      html: wrapHtml(`
<p>Hi ${firstName},</p>

<p>I'm ready.</p>

<p>This is the 7 minutes where we see whether Elystra fits your operation and deserves to sit underneath your sales motion.</p>

<a href="${demo.join_url}" class="cta">Join Walkthrough</a>

<p>Join here:<br>
<span class="muted">${demo.join_url}</span></p>

<p>If timing moved on your side, <strong>reply RESCHEDULE</strong> and we'll rebook it cleanly.</p>

<p>Best,<br>
David<br>
Elystra</p>
      `),
      text: `Hi ${firstName},

I'm ready.

This is the 7 minutes where we see whether Elystra fits your operation and deserves to sit underneath your sales motion.

Join here: ${demo.join_url}

If timing moved on your side, reply RESCHEDULE and we'll rebook it cleanly.

Best,
David
Elystra`,
    };
  }

  /**
   * POST_NO_SHOW: T+1h after demo
   */
  static postNoShow(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];
    const rescheduleUrl = process.env.RESCHEDULE_URL || demo.join_url;

    return {
      subject: `Missed you today - still worth 7 minutes?`,
      html: wrapHtml(`
<p>Hi ${firstName},</p>

<p>We missed each other today.</p>

<p>If it is still worth seeing whether Elystra can give your agency a real shot at breaking the 10-30% cycle, reducing ghosting, and tightening the sales motion after interest exists, pick a new time here:</p>

<p><a href="${rescheduleUrl}" class="cta">Pick a New Time</a></p>

<p>If not, no problem. We'll leave it there cleanly.</p>

<p>Best,<br>
David<br>
Elystra</p>
      `),
      text: `Hi ${firstName},

We missed each other today.

If it is still worth seeing whether Elystra can give your agency a real shot at breaking the 10-30% cycle, reducing ghosting, and tightening the sales motion after interest exists, pick a new time here:

${rescheduleUrl}

If not, no problem. We'll leave it there cleanly.

Best,
David
Elystra`,
    };
  }
}
