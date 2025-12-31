/**
 * Demo Service
 * Core business logic for demo management
 */

import { db } from '@/lib/db';
import type { Demo, DemoType, DemoStatus, CalendlyEvent } from '@/types/demo';
import { differenceInHours } from 'date-fns';

export class DemoService {
  /**
   * Classify demo type based on time until scheduled
   */
  static classifyDemoType(scheduledAt: Date): DemoType {
    const now = new Date();
    const hoursUntilDemo = differenceInHours(scheduledAt, now);

    if (hoursUntilDemo <= 12) return 'SAME_DAY';
    if (hoursUntilDemo <= 36) return 'NEXT_DAY';
    return 'FUTURE';
  }

  /**
   * Create demo from Calendly webhook
   */
  static async createFromCalendly(event: CalendlyEvent): Promise<Demo> {
    const { payload } = event;
    const scheduledAt = new Date(payload.scheduled_event.start_time);
    const demoType = this.classifyDemoType(scheduledAt);

    // Extract phone from invitee or questions
    let phone = payload.invitee.text_reminder_number || null;
    if (!phone && payload.questions_and_answers) {
      const phoneAnswer = payload.questions_and_answers.find(
        (qa) => qa.question.toLowerCase().includes('phone')
      );
      if (phoneAnswer) phone = phoneAnswer.answer;
    }

    try {
      const demo = await db.demos.insert({
        calendly_event_id: payload.scheduled_event.uuid,
        calendly_invitee_id: payload.invitee.uuid,
        email: payload.invitee.email,
        phone,
        name: payload.invitee.name,
        scheduled_at: scheduledAt.toISOString(),
        timezone: payload.invitee.timezone,
        demo_type: demoType,
        join_url: payload.scheduled_event.location?.join_url || '',
        status: 'PENDING',
      });

      return demo;
    } catch (error: unknown) {
      // Handle duplicate event gracefully
      const err = error as { code?: string };
      if (err.code === '23505') {
        const existing = await this.getByCalendlyEventId(payload.scheduled_event.uuid);
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * Get demo by ID
   */
  static async getById(id: string): Promise<Demo | null> {
    return db.demos.findById(id);
  }

  /**
   * Get demo by Calendly event ID
   */
  static async getByCalendlyEventId(eventId: string): Promise<Demo | null> {
    return db.demos.findByCalendlyEventId(eventId);
  }

  /**
   * Get demo by email (for reply matching)
   */
  static async getByEmail(email: string): Promise<Demo | null> {
    return db.demos.findByEmail(email);
  }

  /**
   * Get demo by phone (for SMS reply matching)
   */
  static async getByPhone(phone: string): Promise<Demo | null> {
    return db.demos.findByPhone(phone);
  }

  /**
   * Update demo status
   */
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

  /**
   * Mark demo as joined (user showed up)
   */
  static async markJoined(id: string): Promise<Demo> {
    return this.updateStatus(id, 'COMPLETED', {
      joined_at: new Date().toISOString(),
    });
  }

  /**
   * Cancel demo (from Calendly webhook)
   */
  static async cancel(calendlyEventId: string): Promise<void> {
    const demo = await this.getByCalendlyEventId(calendlyEventId);
    if (!demo) return;

    await this.updateStatus(demo.id, 'CANCELLED');
  }

  /**
   * Get demos needing no-show check
   */
  static async getDemosForNoShowCheck(): Promise<Demo[]> {
    return db.demos.findForNoShowCheck();
  }
}
