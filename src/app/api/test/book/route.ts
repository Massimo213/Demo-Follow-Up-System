/**
 * Test booking endpoint
 * Simulates a Calendly webhook - creates demo + schedules jobs
 * 
 * POST /api/test/book
 * { "email": "...", "name": "...", "scheduledAt": "ISO date" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DemoService } from '@/services/demo.service';
import { SchedulerService } from '@/services/scheduler.service';
import { stampIngest } from '@/lib/ingest';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, scheduledAt, joinUrl } = body;

    if (!email || !scheduledAt) {
      return NextResponse.json({ error: 'email and scheduledAt required' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledAt);
    const now = new Date();
    const demoType = DemoService.classifyDemoType(scheduledDate);
    const ingest = stampIngest({
      scheduledAt: scheduledDate,
      insertedAt: now,
      path: 'test',
      rawPhone: null,
    });

    // Create demo
    const demoId = `test-${Date.now()}`;
    const demo = await db.demos.insert({
      calendly_event_id: demoId,
      calendly_invitee_id: `invitee-${Date.now()}`,
      email,
      phone: null,
      name: name || 'Test User',
      scheduled_at: scheduledDate.toISOString(),
      timezone: 'Europe/Paris',
      demo_type: demoType,
      join_url: joinUrl || 'https://zoom.us/j/123456789',
      status: 'PENDING',
      ...ingest,
    });

    console.log(`Created demo ${demo.id} (${demoType}) for ${email}`);

    // Schedule the sequence
    await SchedulerService.scheduleSequence(demo);

    // Get scheduled jobs
    const jobs = await db.jobs.findPending(demo.id);

    return NextResponse.json({
      status: 'booked',
      demo: {
        id: demo.id,
        email: demo.email,
        scheduled_at: demo.scheduled_at,
        demo_type: demo.demo_type,
      },
      scheduled_jobs: jobs.map(j => ({
        message_type: j.message_type,
        scheduled_for: j.scheduled_for,
      })),
      next_step: 'Run GET /api/cron to process due messages',
    });
  } catch (error) {
    console.error('Book error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}



