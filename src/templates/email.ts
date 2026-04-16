/**
 * Email Templates v2
 * Consequence-driven attendance frame + infrastructure identity (infrastructural review, not product tour).
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

  static confirmInitial(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Locked: 7-minute Elystra walkthrough - ${time}`,
      html: wrapHtml(`
<p>Hey ${firstName},</p>

<p>I've locked <strong>${time}</strong> for your 7-minute walkthrough.</p>

<p>170+ agencies were leaking money after buyer interest already existed. Elystra gave them control over that part of the sale. That is what moved the numbers.</p>

<p>I'll show you where your current sales motion is leaking, and whether Elystra deserves to sit underneath it.</p>

${demo.join_url ? `<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>` : ''}

<p>What we'll cover:</p>
<p>- where your sales motion is losing control between buyer interest and collected cash</p>
<p>- what Elystra controls after buyer interest exists</p>
<p>- whether this deserves to sit under your sales process</p>

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if you need a different time.</p>

<p>David<br>
Elystra</p>
      `),
      text: `Hey ${firstName},

I've locked ${time} for your 7-minute walkthrough.

170+ agencies were leaking money after buyer interest already existed. Elystra gave them control over that part of the sale. That is what moved the numbers.

I'll show you where your current sales motion is leaking, and whether Elystra deserves to sit underneath it.

${demo.join_url ? `Join link: ${demo.join_url}` : ''}

What we'll cover:
- where your sales motion is losing control between buyer interest and collected cash
- what Elystra controls after buyer interest exists
- whether this deserves to sit under your sales process

Reply YES to confirm.

Reply RESCHEDULE if you need a different time.

David
Elystra`,
    };
  }

  static confirmInitialLoom(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];
    const loomUrl = process.env.LOOM_URL || 'https://www.loom.com/share/your-demo-intro';

    return {
      subject: `Locked: 7-minute Elystra walkthrough - ${time}`,
      html: wrapHtml(`
<p>Hey ${firstName},</p>

<p>I've locked <strong>${time}</strong> for your 7-minute walkthrough.</p>

<p>Before we hop on, I recorded a quick 2-minute intro so you know exactly what to expect:</p>

<p><a href="${loomUrl}" class="cta">Watch the intro</a></p>

<p>170+ agencies were leaking money after buyer interest already existed. Elystra gave them control over that part of the sale. That is what moved the numbers.</p>

<p>I'll show you where your current sales motion is leaking, and whether Elystra deserves to sit underneath it.</p>

${demo.join_url ? `<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>` : ''}

<p>What we'll cover:</p>
<p>- where your sales motion is losing control between buyer interest and collected cash</p>
<p>- what Elystra controls after buyer interest exists</p>
<p>- whether this deserves to sit under your sales process</p>

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if you need a different time.</p>

<p>David<br>
Elystra</p>
      `),
      text: `Hey ${firstName},

I've locked ${time} for your 7-minute walkthrough.

Watch a 2-minute intro before we hop on: ${loomUrl}

170+ agencies were leaking money after buyer interest already existed. Elystra gave them control over that part of the sale. That is what moved the numbers.

I'll show you where your current sales motion is leaking, and whether Elystra deserves to sit underneath it.

${demo.join_url ? `Join link: ${demo.join_url}` : ''}

What we'll cover:
- where your sales motion is losing control between buyer interest and collected cash
- what Elystra controls after buyer interest exists
- whether this deserves to sit under your sales process

Reply YES to confirm.

Reply RESCHEDULE if you need a different time.

David
Elystra`,
    };
  }

  static confirmReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} - today at ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'd like to know if we're still on for <strong>${time} today</strong> so I know whether to release the slot or hold it for you.</p>

<p>7 minutes. Infrastructural review: where your sales motion loses control between buyer interest and collected cash, not a product tour.</p>

<p><strong>Reply YES</strong> to confirm.</p>

<p><strong>Reply RESCHEDULE</strong> if something changed.</p>

<p>David<br>
Elystra</p>
      `),
      text: `${firstName},

I'd like to know if we're still on for ${time} today so I know whether to release the slot or hold it for you.

7 minutes. Infrastructural review: where your sales motion loses control between buyer interest and collected cash, not a product tour.

Reply YES to confirm.

Reply RESCHEDULE if something changed.

David
Elystra`,
    };
  }

  static dayOfReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} - today at ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>We're on for <strong>${time} today</strong>. Quick number: one agency on this flow pulled $14K in overdue invoices within 48 hours. No hiring, no extra spend.</p>

<p>170+ agencies installed Elystra under the part of the sales motion where money usually leaks. That is what changed close rate, follow-up quality, and collections. 7 minutes to see if it belongs under yours.</p>

<p><strong>Reply YES</strong> to hold your slot.</p>

<p><strong>Reply RESCHEDULE</strong> if something broke. I'd rather move it than have an empty chair.</p>

<p>David<br>
Elystra</p>
      `),
      text: `${firstName},

We're on for ${time} today. Quick number: one agency on this flow pulled $14K in overdue invoices within 48 hours. No hiring, no extra spend.

170+ agencies installed Elystra under the part of the sales motion where money usually leaks. That is what changed close rate, follow-up quality, and collections. 7 minutes to see if it belongs under yours.

Reply YES to hold your slot.

Reply RESCHEDULE if something broke. I'd rather move it than have an empty chair.

David
Elystra`,
    };
  }

  static valueBomb(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const day = formatDay(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Quick number before ${day}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Before our 7-minute walkthrough on <strong>${time}</strong>:</p>

<p>One agency on this flow pulled $14K in overdue invoices within 48 hours. Not from hiring or spend. From taking control between proposal and collected cash.</p>

<p>170+ agencies installed Elystra under the part of the sale where money usually leaks. Same structural move.</p>

<p>No ask - just context before we talk. See you ${day}.</p>

<p>David<br>
Elystra</p>
      `),
      text: `${firstName},

Before our 7-minute walkthrough on ${time}:

One agency on this flow pulled $104K in overdue invoices within 48 hours. Not from hiring or spend. From taking complete control of there deals and having the right infrastructure .
170+ agencies installed Elystra under the part of the sale where money usually leaks.

Just context before we talk. See you ${day}.

David
Elystra`,
    };
  }

  static joinLink(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Join link : 7-minute walkthrough starting now`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'm ready. This is the infrastructural review: where your motion is exposed after buyer interest exists, what Elystra controls in that stretch, and whether it deserves to sit under your process.</p>

<a href="${demo.join_url}" class="cta">Join Walkthrough</a>

<p>Or copy this link:<br>
<span class="muted">${demo.join_url}</span></p>

<p>If timing blew up on your side, <strong>reply RESCHEDULE</strong> and I'll give your slot to someone else.</p>

<p class="muted">If I don't hear back, I'll assume this isn't a priority and close the file.</p>

<p>David<br>
Elystra</p>
      `),
      text: `${firstName},

I'm ready. This is the infrastructural review: where your motion is exposed after buyer interest exists, what Elystra controls in that stretch, and whether it deserves to sit under your process.

Join here: ${demo.join_url}

If timing blew up on your side, reply RESCHEDULE and I'll give your slot to someone else.

If I don't hear back, I'll assume this isn't a priority and close the file.

David
Elystra`,
    };
  }

  static postNoShow(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];
    const rescheduleUrl = process.env.RESCHEDULE_URL || demo.join_url;

    return {
      subject: `Missed you today - still worth 7 minutes?`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>We missed each other today. These things happen.</p>

<p>If it's still worth 7 minutes to see how 170+ agencies took control after buyer interest already existed, and what that did to close rate and collections, grab a new slot:</p>

<p><a href="${rescheduleUrl}" class="cta">Pick a New Time</a></p>

<p>If not, I'll close the file on my end. No follow-up, no hard feelings.</p>

<p>David<br>
Elystra</p>
      `),
      text: `${firstName},

We missed each other today. These things happen.

If it's still worth 7 minutes to see how 170+ agencies took control after buyer interest already existed, and what that did to close rate and collections, grab a new slot:

${rescheduleUrl}

If not, I'll close the file on my end. No follow-up, no hard feelings.

David
Elystra`,
    };
  }
}
