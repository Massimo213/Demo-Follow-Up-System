/**
 * Reply Service
 * Parses inbound email replies and updates demo state
 */

import { db } from '@/lib/db';
import { DemoService } from './demo.service';
import { SchedulerService } from './scheduler.service';
import type { Demo, Reply } from '@/types/demo';

type ParsedIntent = 'YES' | 'RESCHEDULE' | 'SOONER' | '1' | '2' | 'UNKNOWN';

/** Inbound Twilio SMS → automation intents (full body scanned, not truncated). */
export type SmsParsedIntent = 'YES' | 'STOP' | 'RESCHEDULE' | 'CLOSE' | 'CANCEL' | 'UNKNOWN';

export class ReplyService {
  /**
   * Parse SMS reply intent using the entire message (any length).
   * Order: STOP → short codes → keyword scans on full text.
   */
  static parseSmsIntent(body: string): SmsParsedIntent {
    const raw = body.trim();
    if (!raw) return 'UNKNOWN';
    const lower = raw.toLowerCase();

    if (/\b(stop|unsubscribe)\b/i.test(raw)) return 'STOP';

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
   */
  static parseIntent(body: string): ParsedIntent {
    const normalized = body.trim().toLowerCase();

    // YES patterns
    if (/^(yes|yep|yeah|yup|y|confirm|confirmed|i'?m in|count me in|see you|sounds good|perfect|great|ok|okay|good|👍|✓|✔)$/i.test(normalized)) {
      return 'YES';
    }
    if (/\b(yes|confirm|i'?ll be there|i'?m coming|see you then)\b/i.test(normalized)) {
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
    if (/\b(option 1|first one|morning)\b/i.test(normalized)) return '1';
    if (/\b(option 2|second one|afternoon)\b/i.test(normalized)) return '2';

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

    // Execute the action
    const action = await this.executeIntent(demo, intent);

    return { demo, intent, action };
  }

  /**
   * Execute action based on intent
   */
  static async executeIntent(demo: Demo, intent: ParsedIntent): Promise<string> {
    switch (intent) {
      case 'YES':
        return this.handleConfirmation(demo);

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
