/**
 * Test booking — exercises the Calendly webhook ingest path end-to-end.
 * Pass: jobs created in under 10 seconds.
 *
 * POST /api/test/book
 * { "email": "...", "name": "...", "scheduledAt": "ISO", "phone": "+1..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildCalendlyWebhookEvent } from '@/lib/calendly';
import { CalendlyIngestService } from '@/services/calendly-ingest.service';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PASS_MS = 10_000;

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_BOOK !== 'true') {
      return NextResponse.json({ error: 'Disabled in production' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, scheduledAt, joinUrl, phone } = body;

    if (!email || !scheduledAt) {
      return NextResponse.json({ error: 'email and scheduledAt required' }, { status: 400 });
    }

    const event = buildCalendlyWebhookEvent({
      email,
      name,
      scheduledAt,
      phone: phone ?? '+15551234567',
      joinUrl,
    });

    const started = Date.now();
    const result = await CalendlyIngestService.processInviteeCreated(event);
    const elapsed_ms = Date.now() - started;

    const jobs = await db.jobs.findPending(result.demo_id);
    const pass = elapsed_ms < PASS_MS && jobs.length > 0;

    return NextResponse.json({
      status: pass ? 'pass' : 'fail',
      ingest_path: 'webhook',
      elapsed_ms,
      pass_threshold_ms: PASS_MS,
      pass,
      ...result,
      scheduled_jobs: jobs.map((j) => ({
        message_type: j.message_type,
        scheduled_for: j.scheduled_for,
      })),
      next_step: pass
        ? 'Jobs created — run GET /api/cron to process due messages'
        : `Expected jobs in <${PASS_MS}ms; got ${jobs.length} jobs in ${elapsed_ms}ms`,
    });
  } catch (error) {
    console.error('[TEST-BOOK] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
