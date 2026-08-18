/**
 * Demo Service
 * Core business logic for demo management
 */

import { db } from '@/lib/db';
import { extractPhoneFromInvitee } from '@/lib/calendly';
import type { Demo, DemoType, DemoStatus, CalendlyEvent, FocusMetric } from '@/types/demo';
import { differenceInHours } from 'date-fns';
import { stampIngest } from '@/lib/ingest';
import { SchedulerService } from '@/services/scheduler.service';

export class DemoService {
  /**
   * Classify demo type based on time until scheduled (from ingest moment).
   */
  static classifyDemoType(scheduledAt: Date, now = new Date()): DemoType {
    const hoursUntilDemo = differenceInHours(scheduledAt, now);

    if (hoursUntilDemo <= 12) return 'SAME_DAY';
    if (hoursUntilDemo <= 36) return 'NEXT_DAY';
    return 'FUTURE';
  }

  /**
   * Same email books again — cancel jobs on older PENDING/CONFIRMED demos.
   */
  static async supersedeOlderPendingBookings(
    email: string,
    newEventId: string
  ): Promise<number> {
    const others = await db.demos.findOtherPendingByEmail(email, newEventId);
    for (const old of others) {
      await db.demos.updateStatus(old.id, 'RESCHEDULED');
      await SchedulerService.cancelAllJobs(old.id);
      console.log(`[INGEST] Superseded older booking ${old.id} (${old.email}) → RESCHEDULED`);
    }
    return others.length;
  }

  /**
   * Create demo from Calendly webhook (primary ingest path).
   */
  static async createFromCalendly(
    event: CalendlyEvent
  ): Promise<{ demo: Demo; created: boolean; superseded: number }> {
    const { payload } = event;
    const scheduledAt = new Date(payload.scheduled_event.start_time);
    const demoType = this.classifyDemoType(scheduledAt);
    const eventId = payload.scheduled_event.uuid;

    const superseded = await this.supersedeOlderPendingBookings(payload.invitee.email, eventId);

    const phone = extractPhoneFromInvitee({
      text_reminder_number: payload.invitee.text_reminder_number,
      questions_and_answers: payload.questions_and_answers,
    });
    const insertedAt = new Date();
    const ingest = stampIngest({
      scheduledAt,
      insertedAt,
      path: 'webhook',
      rawPhone: phone,
      calendlyCreatedAt:
        payload.scheduled_event.created_at ||
        payload.created_at ||
        payload.invitee.created_at ||
        null,
      tracking: payload.tracking,
    });

    try {
      const demo = await db.demos.insert({
        calendly_event_id: eventId,
        calendly_invitee_id: payload.invitee.uuid,
        email: payload.invitee.email,
        name: payload.invitee.name,
        scheduled_at: scheduledAt.toISOString(),
        timezone: payload.invitee.timezone,
        demo_type: demoType,
        join_url: payload.scheduled_event.location?.join_url || '',
        status: 'PENDING',
        ...ingest,
      });

      return { demo, created: true, superseded };
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === '23505') {
        const existing = await this.getByCalendlyEventId(eventId);
        if (existing) return { demo: existing, created: false, superseded: 0 };
      }
      throw error;
    }
  }

  static async getById(id: string): Promise<Demo | null> {
    return db.demos.findById(id);
  }

  static async getByCalendlyEventId(eventId: string): Promise<Demo | null> {
    return db.demos.findByCalendlyEventId(eventId);
  }

  static async getByEmail(email: string): Promise<Demo | null> {
    return db.demos.findByEmail(email);
  }

  static async getByPhone(phone: string): Promise<Demo | null> {
    return db.demos.findByPhone(phone);
  }

  static async updateStatus(
    id: string,
    status: DemoStatus,
    additionalData?: { confirmed_at?: string; joined_at?: string }
  ): Promise<Demo> {
    const extra: { confirmed_at?: string; joined_at?: string } = {};

    if (status === 'CONFIRMED') {
      extra.confirmed_at = new Date().toISOString();
    }

    if (additionalData?.joined_at) {
      extra.joined_at = additionalData.joined_at;
    }

    return db.demos.updateStatus(id, status, extra);
  }

  static async markJoined(id: string): Promise<Demo> {
    return this.updateStatus(id, 'COMPLETED', {
      joined_at: new Date().toISOString(),
    });
  }

  static async updateFocusMetric(id: string, focusMetric: FocusMetric): Promise<Demo> {
    return db.demos.updateFocusMetric(id, focusMetric);
  }

  static async cancel(calendlyEventId: string): Promise<void> {
    const demo = await this.getByCalendlyEventId(calendlyEventId);
    if (!demo) return;

    await this.updateStatus(demo.id, 'CANCELLED');
  }

  static async getDemosForNoShowCheck(): Promise<Demo[]> {
    return db.demos.findForNoShowCheck();
  }
}
