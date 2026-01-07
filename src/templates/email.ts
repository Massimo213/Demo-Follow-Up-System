/**
 * Email Templates
 * Clean, minimal, conversion-focused
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
    .urgent { color: #dc3545; font-weight: 600; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

export class EmailTemplates {
  static getTemplate(messageType: MessageType, demo: Demo): EmailTemplate | null {
    const templates: Record<MessageType, () => EmailTemplate> = {
      CONFIRM_INITIAL: () => this.confirmInitial(demo),
      CONFIRM_REMINDER: () => this.confirmReminder(demo),
      DAY_OF_REMINDER: () => this.dayOfReminder(demo),
      JOIN_LINK: () => this.joinLink(demo),
      JOIN_URGENT: () => this.joinUrgent(demo),
      SOONER_OFFER: () => this.soonerOffer(demo),
      RECEIPT: () => this.receipt(demo),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }

  /**
   * Initial confirmation request
   */
  static confirmInitial(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Confirm your demo - ${time}`,
      html: wrapHtml(`
<p>Hey ${firstName},</p>

<p>You're booked for <strong>${time}</strong>.</p>

<p><strong>Reply YES</strong> to confirm you'll be there.</p>

<p>If something came up, <strong>reply RESCHEDULE</strong> and I'll send you a link to pick a new time.</p>

<p>Talk soon.</p>
      `),
      text: `Hey ${firstName},

You're booked for ${time}.

Reply YES to confirm you'll be there.

If something came up, reply RESCHEDULE and I'll send you a link to pick a new time.

Talk soon.`,
    };
  }

  /**
   * Reminder confirmation
   */
  static confirmReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Still good for ${time}?`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Quick check - still good for <strong>${time}</strong> today?</p>

<p><strong>Reply YES</strong> to confirm.</p>

<p>If you need to reschedule, just reply RESCHEDULE.</p>
      `),
      text: `${firstName},

Quick check - still good for ${time} today?

Reply YES to confirm.

If you need to reschedule, just reply RESCHEDULE.`,
    };
  }

  /**
   * Day-of reminder (4 hours before) - "Your demo is TODAY"
   */
  static dayOfReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} - Your demo is TODAY at ${time}`,
      html: wrapHtml(`
<p>Hey ${firstName},</p>

<p>Quick reminder - we're meeting <strong>today at ${time}</strong>.</p>

<p>I'll send you the join link closer to the time.</p>

<p><strong>Reply YES</strong> to confirm you'll be there, or <strong>RESCHEDULE</strong> if something came up.</p>

<p>Looking forward to it.</p>
      `),
      text: `Hey ${firstName},

Quick reminder - we're meeting today at ${time}.

I'll send you the join link closer to the time.

Reply YES to confirm you'll be there, or RESCHEDULE if something came up.

Looking forward to it.`,
    };
  }

  /**
   * Join link (10 min before)
   */
  static joinLink(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Join link - I'm ready when you are`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Ready to go.</p>

<a href="${demo.join_url}" class="cta">Join Demo</a>

<p>Or copy this link:<br>
<span class="muted">${demo.join_url}</span></p>

<p>See you in a few.</p>
      `),
      text: `${firstName},

Ready to go.

Join here: ${demo.join_url}

See you in a few.`,
    };
  }

  /**
   * Urgent join (2 min after start)
   */
  static joinUrgent(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `I'm on the call - join now`,
      html: wrapHtml(`
<p class="urgent">${firstName} - I'm on and waiting.</p>

<a href="${demo.join_url}" class="cta">Join Now</a>

<p>Link: ${demo.join_url}</p>
      `),
      text: `${firstName} - I'm on and waiting.

Join now: ${demo.join_url}`,
    };
  }

  /**
   * Offer earlier time (FUTURE demos, T-48h)
   */
  static soonerOffer(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} - I can pull your demo earlier`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Your demo is scheduled for <strong>${time}</strong>.</p>

<p>I have a couple slots earlier if you want to get this done sooner:</p>

<p><strong>Reply 1</strong> - Tomorrow morning<br>
<strong>Reply 2</strong> - Tomorrow afternoon</p>

<p>Or just <strong>reply YES</strong> to keep your current time.</p>

<p class="muted">No reply? I'll follow up to make sure we're still on.</p>
      `),
      text: `${firstName},

Your demo is scheduled for ${time}.

I have a couple slots earlier if you want to get this done sooner:

Reply 1 - Tomorrow morning
Reply 2 - Tomorrow afternoon

Or just reply YES to keep your current time.

No reply? I'll follow up to make sure we're still on.`,
    };
  }

  /**
   * Receipt / calendar confirmation
   */
  static receipt(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `You're all set - ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>You're confirmed for <strong>${time}</strong>.</p>

<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>

<p>What to expect:</p>
<ul>
  <li>Quick 15-minute overview</li>
  <li>See exactly how this fits your use case</li>
  <li>Q&A</li>
</ul>

<p>I'll send a reminder before we start.</p>

<p class="muted">Need to change the time? Just reply to this email.</p>
      `),
      text: `${firstName},

You're confirmed for ${time}.

Join link: ${demo.join_url}

What to expect:
- Quick 15-minute overview
- See exactly how this fits your use case
- Q&A

I'll send a reminder before we start.

Need to change the time? Just reply to this email.`,
    };
  }
}
