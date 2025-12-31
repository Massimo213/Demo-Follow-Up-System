/**
 * Reply Service
 * Parses inbound email replies and updates demo state
 */

import { db } from '@/lib/db';
import { DemoService } from './demo.service';
import { SchedulerService } from './scheduler.service';
import type { Demo, Reply } from '@/types/demo';

type ParsedIntent = 'YES' | 'RESCHEDULE' | 'SOONER' | '1' | '2' | 'UNKNOWN';

export class ReplyService {
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
