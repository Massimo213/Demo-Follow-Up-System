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
    const templates: Partial<Record<MessageType, () => EmailTemplate>> = {
      CONFIRM_INITIAL: () => this.confirmInitial(demo),
      CONFIRM_REMINDER: () => this.confirmReminder(demo),
      DAY_OF_REMINDER: () => this.dayOfReminder(demo),
      JOIN_LINK: () => this.joinLink(demo),
      JOIN_URGENT: () => this.joinUrgent(demo),
      SOONER_OFFER: () => this.soonerOffer(demo),
      RECEIPT: () => this.receipt(demo),
      // SMS types don't need email templates
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }

  /**
   * Initial confirmation request - binary commitment
   */
  static confirmInitial(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Locked: Elystra demo on ${time}`,
      html: wrapHtml(`
<p>Hey ${firstName},</p>

<p>I've locked <strong>${time}</strong> to walk through how agencies are tightening the gap between "send me something" → "we got paid".</p>

<p><strong>Reply YES</strong> to confirm you'll be there.</p>

<p><strong>Reply RESCHEDULE</strong> if you need a different time and I'll send you new options.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `Hey ${firstName},

I've locked ${time} to walk through how agencies are tightening the gap between "send me something" → "we got paid".

Reply YES to confirm you'll be there.

Reply RESCHEDULE if you need a different time and I'll send you new options.

– Elystra 7 minutes Walkthrough`,
    };
  }

  /**
   * Reminder confirmation - binary with deadline
   */
  static confirmReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Still good for ${time}?`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Quick check – are we still good for <strong>${time}</strong> today?</p>

<p><strong>Reply YES</strong> to keep this time.</p>

<p><strong>Reply RESCHEDULE</strong> if something changed – I'd rather move it than have you no-show.</p>

<p class="muted">Reply YES in the next hour, otherwise we'll have to release the slot and we can rebook when you really want to look at this.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `${firstName},

Quick check – are we still good for ${time} today?

Reply YES to keep this time.

Reply RESCHEDULE if something changed – I'd rather move it than have you no-show.

Reply YES in the next hour, otherwise we'll have to release the slot and we can rebook when you really want to look at this.

– Elystra 7 minutes Walkthrough`,
    };
  }

  /**
   * Day-of reminder (4 hours before) - binary commitment
   */
  static dayOfReminder(demo: Demo): EmailTemplate {
    const time = formatShortTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} – today at ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>We're locked for <strong>today at ${time}</strong> – the 7-minute walkthrough where we map how you're losing deals between "send it over" and "we got paid".</p>

<p>I'll send you the join link closer to the time.</p>

<p><strong>Reply YES</strong> if you're good.</p>

<p><strong>Reply RESCHEDULE</strong> if something broke – I'd rather move it than have you ghost.</p>

<p class="muted">No reply = I'll assume we're on.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `${firstName},

We're locked for today at ${time} – the 7-minute walkthrough where we map how you're losing deals between "send it over" and "we got paid".

I'll send you the join link closer to the time.

Reply YES if you're good.

Reply RESCHEDULE if something broke – I'd rather move it than have you ghost.

No reply = I'll assume we're on.

– Elystra 7 minutes Walkthrough`,
    };
  }

  /**
   * Join link (10 min before) - binary with consequences
   */
  static joinLink(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `I'm ready – here's the link`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'm ready on Zoom. This is the session where we map your numbers and see if Elystra actually deserves a place in your operation.</p>

<a href="${demo.join_url}" class="cta">Join Demo</a>

<p>Or copy this link:<br>
<span class="muted">${demo.join_url}</span></p>

<p>If you're stuck in a meeting, just <strong>reply 5</strong> and I'll hold for 5–10 minutes.</p>

<p>If timing blew up on your side, <strong>reply RESCHEDULE</strong> and we'll pick a slot that actually works.</p>

<p class="muted">If I don't hear back, I'll assume it's not a priority right now and close this on my side.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `${firstName},

I'm ready on Zoom. This is the session where we map your numbers and see if Elystra actually deserves a place in your operation.

Join here: ${demo.join_url}

If you're stuck in a meeting, just reply 5 and I'll hold for 5–10 minutes.

If timing blew up on your side, reply RESCHEDULE and we'll pick a slot that actually works.

If I don't hear back, I'll assume it's not a priority right now and close this on my side.

– Elystra 7 minutes Walkthrough`,
    };
  }

  /**
   * Urgent join (2 min after start) - final binary choice
   */
  static joinUrgent(demo: Demo): EmailTemplate {
    const firstName = demo.name.split(' ')[0];
    const time = formatShortTime(demo);

    return {
      subject: `On the call now – join or reschedule`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>I'm on the call now at <strong>${time}</strong>. If you still want to see how agencies are closing extra deals from the follow-up rail, jump in:</p>

<a href="${demo.join_url}" class="cta">Join Now</a>

<p>Link: ${demo.join_url}</p>

<p>If timing blew up on your side, <strong>reply RESCHEDULE</strong> and we'll pick a slot that actually works.</p>

<p class="muted">If I don't hear back, I'll assume it's not a priority right now and close this on my side.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `${firstName},

I'm on the call now at ${time}. If you still want to see how agencies are closing extra deals from the follow-up rail, jump in:

${demo.join_url}

If timing blew up on your side, reply RESCHEDULE and we'll pick a slot that actually works.

If I don't hear back, I'll assume it's not a priority right now and close this on my side.

– Elystra 7 minutes Walkthrough`,
    };
  }

  /**
   * Offer earlier time (FUTURE demos, T-48h) - binary with options
   */
  static soonerOffer(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `${firstName} – can pull your demo earlier`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>Your Elystra walkthrough is locked for <strong>${time}</strong>.</p>

<p>I've got a couple slots earlier if you want to knock this out sooner:</p>

<p><strong>Reply 1</strong> – Tomorrow morning<br>
<strong>Reply 2</strong> – Tomorrow afternoon<br>
<strong>Reply YES</strong> – Keep current time</p>

<p class="muted">No reply = we're still on for ${time}.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `${firstName},

Your Elystra walkthrough is locked for ${time}.

I've got a couple slots earlier if you want to knock this out sooner:

Reply 1 – Tomorrow morning
Reply 2 – Tomorrow afternoon
Reply YES – Keep current time

No reply = we're still on for ${time}.

– Elystra 7 minutes Walkthrough`,
    };
  }

  /**
   * Receipt / calendar confirmation - sets expectations
   */
  static receipt(demo: Demo): EmailTemplate {
    const time = formatDemoTime(demo);
    const firstName = demo.name.split(' ')[0];

    return {
      subject: `Locked: ${time}`,
      html: wrapHtml(`
<p>${firstName},</p>

<p>You're locked for <strong>${time}</strong>.</p>

<p><strong>Join link:</strong> <a href="${demo.join_url}">${demo.join_url}</a></p>

<p>What we'll cover in 7 minutes:</p>
<ul>
  <li>Where deals are dying between "send it over" → "we got paid"</li>
  <li>How agencies are tightening that gap with Elystra</li>
  <li>Whether this actually fits your operation</li>
</ul>

<p>I'll send a reminder before we start.</p>

<p><strong>Reply RESCHEDULE</strong> if timing changes – I'd rather move it than have you no-show.</p>

<p>– Elystra 7 minutes Walkthrough</p>
      `),
      text: `${firstName},

You're locked for ${time}.

Join link: ${demo.join_url}

What we'll cover in 7 minutes:
- Where deals are dying between "send it over" → "we got paid"
- How agencies are tightening that gap with Elystra
- Whether this actually fits your operation

I'll send a reminder before we start.

Reply RESCHEDULE if timing changes – I'd rather move it than have you no-show.

– Elystra 7 minutes Walkthrough`,
    };
  }
}
