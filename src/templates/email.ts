/**
 * Email Templates v2
 * Consequence-driven. Passive aggression. Social proof.
 * Every email demands YES / RESCHEDULE. No soft outs.
 * Signed: David, Elystra
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
      CONFIRM_REMINDER: () => this.confirmReminder(demo),
      DAY_OF_REMINDER: () => this.dayOfReminder(demo),
      VALUE_BOMB: () => this.valueBomb(demo),
      JOIN_LINK: () => this.joinLink(demo),
      POST_NO_SHOW: () => this.postNoShow(demo),
      // Legacy types still handled for old scheduled jobs
      JOIN_URGENT: () => this.joinLink(demo),
      SOONER_OFFER: () => this.valueBomb(demo),
      RECEIPT: () => this.confirmInitial(demo),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }

  /**
   * CONFIRM_INITIAL: Immediate after booking
   * Merged with RECEIPT - one email does both jobs
   * Social proof + join link + binary YES/RESCHEDULE
   */
  static confirmInitial(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Locked: 7-minute Elystra walkthrough -- ${time}`,
      html: wrapHtml(`
<p>Hey ${firstName},</p>

<p>I've locked <strong>${time}</strong> for your 7-minute walkthrough.</p>

<p>166 agencies were sitting at a 45% close rate before tightening the gap between "send it over" and getting paid. Today they're at 66% -- without scaling a dime.</p>

<p>I'll show you how in 7 minutes.</p>

${demo.join_url ? `<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>` : ''}

<p>What we'll cover:</p>
<ul>
  <li>Where deals are leaking between "send it over" and "we got paid"</li>
  <li>How agencies are tightening that gap with Elystra</li>
  <li>Whether this actually fits your operation</li>
</ul>

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if you need a different time.</p>

<p>-- David, Elystra</p>
      `),
      text: `Hey ${firstName},

I've locked ${time} for your 7-minute walkthrough.

166 agencies were sitting at a 45% close rate before tightening the gap between "send it over" and getting paid. Today they're at 66% -- without scaling a dime.

I'll show you how in 7 minutes.

${demo.join_url ? `Join link: ${demo.join_url}` : ''}

What we'll cover:
- Where deals are leaking between "send it over" and "we got paid"
- How agencies are tightening that gap with Elystra
- Whether this actually fits your operation

Reply YES to confirm.

Reply RESCHEDULE if you need a different time.

-- David, Elystra`,
    };
  }

  /**
   * CONFIRM_REMINDER: Morning-of for NEXT_DAY (T-4h)
   * Passive aggression: "so I know whether to release the slot"
   */
  static confirmReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} -- today at ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'd like to know if we're still on for <strong>${time} today</strong> so I know whether to release the slot or hold it for you.</p>

<p>7 minutes. We map where your deals are leaking between "send it over" and "we got paid."</p>

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if something changed.</p>

<p>-- David, Elystra</p>
      `),
      text: `${firstName},

I'd like to know if we're still on for ${time} today so I know whether to release the slot or hold it for you.

7 minutes. We map where your deals are leaking between "send it over" and "we got paid."

Reply YES to confirm.

Reply RESCHEDULE if something changed.

-- David, Elystra`,
    };
  }

  /**
   * DAY_OF_REMINDER: Morning-of for FUTURE demos (T-4h)
   * Same pressure, different framing
   */
  static dayOfReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} -- today at ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'd like to confirm we're still on for <strong>${time} today</strong>. I have a few people waiting for a slot, so I want to make sure yours is held.</p>

<p>7 minutes. We'll map where your deals are leaking between "send it over" and "we got paid." 166 agencies already tightened that gap -- I'll show you exactly how.</p>

<p><strong>Reply YES</strong> to hold your slot.</p>

<p><strong>Reply RESCHEDULE</strong> if something broke -- I'd rather move it than have an empty chair.</p>

<p>-- David, Elystra</p>
      `),
      text: `${firstName},

I'd like to confirm we're still on for ${time} today. I have a few people waiting for a slot, so I want to make sure yours is held.

7 minutes. We'll map where your deals are leaking between "send it over" and "we got paid." 166 agencies already tightened that gap -- I'll show you exactly how.

Reply YES to hold your slot.

Reply RESCHEDULE if something broke -- I'd rather move it than have an empty chair.

-- David, Elystra`,
    };
  }

  /**
   * VALUE_BOMB: T-48h for FUTURE demos
   * Pure value. No ask. Plant the seed.
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

<p>166 agencies went from 45% to 66% close rate with the same approach.</p>

<p>No ask -- just wanted you to have context before we talk. See you ${day}.</p>

<p>-- David, Elystra</p>
      `),
      text: `${firstName},

Before our 7-minute walkthrough on ${time}:

One agency using this exact flow pulled $14K in overdue invoices within 48 hours. Not by hiring. Not by scaling spend. Just by tightening the gap between proposal and payment.

166 agencies went from 45% to 66% close rate with the same approach.

No ask -- just wanted you to have context before we talk. See you ${day}.

-- David, Elystra`,
    };
  }

  /**
   * JOIN_LINK: T-10min
   * Binary: join, reschedule, or I close the file
   */
  static joinLink(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Join link -- 7-minute walkthrough starting now`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'm ready. This is the 7 minutes where we see if Elystra actually fits your operation.</p>

<a href="${demo.join_url}" class="cta">Join Walkthrough</a>

<p>Or copy this link:<br>
<span class="muted">${demo.join_url}</span></p>

<p>If timing blew up on your side, <strong>reply RESCHEDULE</strong> and I'll give your slot to someone else.</p>

<p class="muted">If I don't hear back, I'll assume this isn't a priority and close the file.</p>

<p>-- David, Elystra</p>
      `),
      text: `${firstName},

I'm ready. This is the 7 minutes where we see if Elystra actually fits your operation.

Join here: ${demo.join_url}

If timing blew up on your side, reply RESCHEDULE and I'll give your slot to someone else.

If I don't hear back, I'll assume this isn't a priority and close the file.

-- David, Elystra`,
    };
  }

  /**
   * POST_NO_SHOW: T+1h after demo
   * Last chance. Graceful but final. No status drop.
   */
  static postNoShow(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];
    const rescheduleUrl = process.env.RESCHEDULE_URL || demo.join_url;

    return {
      subject: `Missed you today -- still worth 7 minutes?`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>We missed each other today. These things happen.</p>

<p>If it's still worth 7 minutes to see how 166 agencies pushed their close rate from 45% to 66%, grab a new slot:</p>

<p><a href="${rescheduleUrl}" class="cta">Pick a New Time</a></p>

<p>If not, I'll close the file on my end. No follow-up, no hard feelings.</p>

<p>-- David, Elystra</p>
      `),
      text: `${firstName},

We missed each other today. These things happen.

If it's still worth 7 minutes to see how 166 agencies pushed their close rate from 45% to 66%, grab a new slot:

${rescheduleUrl}

If not, I'll close the file on my end. No follow-up, no hard feelings.

-- David, Elystra`,
    };
  }
}
