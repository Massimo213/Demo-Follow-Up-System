/**
 * Reply Service
 * Parses inbound email replies and updates demo state
 */

import { db } from '@/lib/db';
import { DemoService } from './demo.service';
import { SchedulerService } from './scheduler.service';
import type { Demo, Reply, FocusMetric } from '@/types/demo';
import { extractPainReply } from '@/lib/pain-reply';

type ParsedIntent = 'YES' | 'RESCHEDULE' | 'SOONER' | '1' | '2' | 'PAIN' | 'UNKNOWN';

/** Focus metric values from commitment ladder */
type ParsedFocusMetric = Exclude<FocusMetric, null | undefined>;

/** Inbound Twilio SMS → automation intents (full body scanned, not truncated). */
export type SmsParsedIntent = 'YES' | 'STOP' | 'RESCHEDULE' | 'CLOSE' | 'CANCEL' | 'UNKNOWN';

export class ReplyService {
  /**
   * Parse focus metric from reply body (commitment ladder response)
   * Returns the metric if detected, null otherwise
   */
  static parseFocusMetric(body: string): ParsedFocusMetric | null {
    const normalized = body.trim().toLowerCase();

    // Close rate patterns
    if (/\b(close rate|close-rate|closerate|closing rate|conversion|conversion rate|win rate)\b/i.test(normalized)) {
      return 'close_rate';
    }
    if (/^(close|closing|conversion|win)$/i.test(normalized)) {
      return 'close_rate';
    }

    // Deal size patterns — before generic "revenue", so "revenue per deal" stays deal size.
    if (/\b(deal size|deal-size|dealsize|average deal|avg deal|ticket size|contract size|revenue per deal)\b/i.test(normalized)) {
      return 'deal_size';
    }
    if (/^(deal|deals|size|average|ticket)$/i.test(normalized)) {
      return 'deal_size';
    }

    // Total revenue collected — the third option on the confirm email.
    if (
      /\b(total revenue(?: collected)?(?: per month)?|revenue collected|monthly revenue|collected revenue)\b/i.test(
        normalized
      )
    ) {
      return 'revenue';
    }
    if (/^(revenue|revenues)$/i.test(normalized)) {
      return 'revenue';
    }
    if (/\brevenue\b/i.test(normalized)) {
      return 'revenue';
    }

    // Follow-up patterns
    if (/\b(follow up|follow-up|followup|follow ups|following up|pipeline|pipeline velocity|speed|time to close)\b/i.test(normalized)) {
      return 'follow_up';
    }
    if (/^(follow|followup|pipeline|velocity|speed)$/i.test(normalized)) {
      return 'follow_up';
    }

    // Numeric close rate: "32%", "32 percent", "32"
    const pctMatch = normalized.match(/^(\d{1,2})(?:\s*%|\s*percent|\s*pc)?$/);
    if (pctMatch) {
      const n = Number(pctMatch[1]);
      if (n >= 0 && n <= 100) return 'close_rate';
    }

    return null;
  }

  /**
   * Parse SMS reply intent using the entire message (any length).
   * Order: STOP → focus metric → short codes → keyword scans on full text.
   */
  static parseSmsIntent(body: string): SmsParsedIntent {
    const raw = body.trim();
    if (!raw) return 'UNKNOWN';
    const lower = raw.toLowerCase();

    if (/\b(stop|unsubscribe)\b/i.test(raw)) return 'STOP';

    if (/^c[.!\s]*$/i.test(raw)) return 'YES';

    if (/^(yes|y|yep|yeah|yup)[.!\s]*$/i.test(lower)) return 'YES';
    if (/^r[.!\s]*$/i.test(lower)) return 'RESCHEDULE';
    if (/^a[.!\s]*$/i.test(lower)) return 'RESCHEDULE';
    if (/^b[.!\s]*$/i.test(lower)) return 'CLOSE';

    if (/^(yes|yep|yeah|yup|y|confirm|confirmed|i'?m in|count me in|see you|sounds good|perfect|great|ok|okay|good)[.!\s]*$/i.test(lower)) {
      return 'YES';
    }
    if (
      /\b(yes|confirm|confirmed|i'?m in|i'?ll be there|i'?m coming|see you then|sounds good|locked in|we are good|we'?re good|still on|good to go|absolutely|certainly)\b/i.test(
        lower
      )
    ) {
      return 'YES';
    }

    if (
      /^(reschedule|cancel|can'?t|cannot|won'?t|unable|no|nope|n|change|move|different time|another time)$/i.test(lower)
    ) {
      return 'RESCHEDULE';
    }
    if (
      /\b(reschedule|can'?t make|won'?t work|need to cancel|change the time|different time|another time|move it|push it|not available|have to move|need (a )?different|another slot|rebook|pick a new|new time|flexibility|postpone)\b/i.test(
        lower
      )
    ) {
      return 'RESCHEDULE';
    }

    if (
      /\b(hope|please|asking|request).*\b(reschedule|different time|another time|move|change (the )?time|flexib(le|ility))\b/i.test(
        lower
      ) ||
      /\b(reschedule|different time|another time)\b.*\b(hope|please|request|consideration)\b/i.test(lower) ||
      /\bhope\b.*\bconsideration\b.*\b(request|given)\b/i.test(lower)
    ) {
      return 'RESCHEDULE';
    }

    if (
      /^no$|^nope$|\b(can'?t make it|have to cancel|won'?t make it|cancel(ling)? (the |my |our )?(call|meeting|demo|slot))\b/i.test(
        lower
      )
    ) {
      return 'CANCEL';
    }

    if (/\b(close (the )?file|close my file|going with someone else|not interested anymore)\b/i.test(lower)) {
      return 'CLOSE';
    }

    return 'UNKNOWN';
  }

  /**
   * Parse intent from reply body
   * Now includes focus metric detection for commitment ladder
   */
  static parseIntent(body: string): ParsedIntent {
    const normalized = body.trim().toLowerCase();

    // YES only when the whole reply is a confirmation.
    // A longer reply is their answer, even if it starts with yes.
    if (/^(yes|yep|yeah|yup|y|confirm|confirmed|i'?m in|count me in|see you|see you then|i'?ll be there|i'?m coming|sounds good|perfect|great|ok|okay|good|still on|👍|✓|✔)$/i.test(normalized)) {
      return 'YES';
    }
    const afterYes = normalized.replace(/^(?:yes|yep|yeah|yup|y|confirm|confirmed|ok|okay|sure)[,.!\s]+/i, '').trim();
    if (
      afterYes &&
      afterYes !== normalized &&
      /^(i'?m in|count me in|see you|see you then|i'?ll be there|i will be there|i'?m coming|sounds good|perfect|great|still on|confirmed)$/i.test(afterYes)
    ) {
      return 'YES';
    }

    // RESCHEDULE patterns
    if (/^(reschedule|cancel|can'?t|cannot|won'?t|unable|no|nope|n|change|move|different time|another time)$/i.test(normalized)) {
      return 'RESCHEDULE';
    }
    if (/\b(reschedule|can'?t make|won'?t work|need to cancel|change the time|different time|move it)\b/i.test(normalized)) {
      return 'RESCHEDULE';
    }

    // SOONER patterns
    if (/^(sooner|earlier|asap|now|today|tomorrow|1|2)$/i.test(normalized)) {
      if (normalized === '1') return '1';
      if (normalized === '2') return '2';
      return 'SOONER';
    }

    // Option selection (1 or 2)
    if (/^1$/.test(normalized)) return '1';
    if (/^2$/.test(normalized)) return '2';
    if (/^(option 1|first one|morning)$/i.test(normalized)) return '1';
    if (/^(option 2|second one|afternoon)$/i.test(normalized)) return '2';

    if (extractPainReply(body)) return 'PAIN';

    return 'UNKNOWN';
  }

  /**
   * Process inbound email reply
   */
  static async processReply(
    fromEmail: string,
    body: string
  ): Promise<{ demo: Demo | null; intent: ParsedIntent; action: string }> {
    const intent = this.parseIntent(body);

    // Find the demo this reply is for
    const demo = await DemoService.getByEmail(fromEmail);

    // Record the reply
    await db.replies.insert({
      demo_id: demo?.id || null,
      channel: 'EMAIL',
      from_address: fromEmail,
      body,
      intent,
      processed: !!demo,
    });

    if (!demo) {
      console.warn(`No demo found for reply from ${fromEmail}`);
      return { demo: null, intent, action: 'NO_DEMO_FOUND' };
    }

    // Execute the action (pass body for focus metric extraction)
    const action = await this.executeIntent(demo, intent, body);

    return { demo, intent, action };
  }

  /**
   * Execute action based on intent
   */
  static async executeIntent(demo: Demo, intent: ParsedIntent, replyBody?: string): Promise<string> {
    switch (intent) {
      case 'YES':
        return this.handleConfirmation(demo);

      case 'PAIN':
        return this.handlePainReply(demo, replyBody || '');

      case 'RESCHEDULE':
        return this.handleReschedule(demo);

      case 'SOONER':
      case '1':
      case '2':
        return this.handleSoonerRequest(demo, intent);

      case 'UNKNOWN':
      default:
        return 'UNKNOWN_INTENT';
    }
  }

  /**
   * Handle YES confirmation
   */
  static async handleConfirmation(demo: Demo): Promise<string> {
    await DemoService.updateStatus(demo.id, 'CONFIRMED');
    console.log(`Demo ${demo.id} confirmed by ${demo.email}`);
    return 'CONFIRMED';
  }

  /**
   * They answered the open question. Store their words and treat the booking as confirmed.
   * Later messages quote this instead of a category.
   */
  static async handlePainReply(demo: Demo, replyBody: string): Promise<string> {
    const reply = extractPainReply(replyBody);
    if (!reply) return 'PAIN_EMPTY';
    await DemoService.savePainReply(demo.id, reply);
    console.log(`Demo ${demo.id} focus_reply saved (${reply.length} chars) by ${demo.email}`);
    return 'PAIN_SAVED';
  }

  /**
   * Handle RESCHEDULE request
   */
  static async handleReschedule(demo: Demo): Promise<string> {
    await DemoService.updateStatus(demo.id, 'RESCHEDULED');
    await SchedulerService.cancelAllJobs(demo.id);
    console.log(`Demo ${demo.id} rescheduled by ${demo.email}`);
    return 'RESCHEDULED';
  }

  /**
   * Handle SOONER request or option selection
   */
  static async handleSoonerRequest(demo: Demo, intent: ParsedIntent): Promise<string> {
    console.log(`Demo ${demo.id} wants sooner time (${intent})`);
    // In future: integrate with Calendly API to offer slots
    return `SOONER_REQUESTED_${intent}`;
  }

  /**
   * Get unprocessed replies (for manual review)
   */
  static async getUnprocessedReplies(): Promise<Reply[]> {
    return db.replies.findUnprocessed();
  }
}
