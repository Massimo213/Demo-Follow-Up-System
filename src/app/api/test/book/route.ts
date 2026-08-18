/**
 * Test booking — exercises the real Calendly webhook HTTP path end-to-end.
 * Pass: jobs created in under 10 seconds via POST /api/webhooks/calendly.
 *
 * POST /api/test/book
 * { "email": "...", "name": "...", "scheduledAt": "ISO", "phone": "+1..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildCalendlyWebhookEvent,
  signCalendlyWebhookPayload,
} from '@/lib/calendly';
import { db } from '@/lib/db';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

const PASS_MS = 10_000;

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_BOOK !== 'true') {
      return NextResponse.json({ error: 'Disabled in production' }, { status: 403 });
    }

    const secret = (process.env.CALENDLY_WEBHOOK_SECRET ?? '').trim();
    if (!secret) {
      return NextResponse.json(
        {
          error:
            'CALENDLY_WEBHOOK_SECRET required — create a Calendly webhook subscription (Standard plan) first',
        },
        { status: 500 }
      );
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

    const payload = JSON.stringify(event);
    const signature = signCalendlyWebhookPayload(payload, secret);
    const webhookUrl = `${config.app.url.replace(/\/$/, '')}/api/webhooks/calendly`;

    const started = Date.now();
    const whRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'calendly-webhook-signature': signature,
      },
      body: payload,
    });
    const whBody = await whRes.json().catch(() => ({}));
    const elapsed_ms = Date.now() - started;

    if (!whRes.ok) {
      return NextResponse.json(
        {
          status: 'fail',
          ingest_path: 'webhook',
          elapsed_ms,
          http_status: whRes.status,
          webhook_url: webhookUrl,
          error: whBody,
        },
        { status: whRes.status }
      );
    }

    const demoId = (whBody as { demo_id?: string }).demo_id;
    const jobs = demoId ? await db.jobs.findPending(demoId) : [];
    const pass = elapsed_ms < PASS_MS && jobs.length > 0;

    return NextResponse.json({
      status: pass ? 'pass' : 'fail',
      ingest_path: 'webhook',
      elapsed_ms,
      pass_threshold_ms: PASS_MS,
      pass,
      webhook_url: webhookUrl,
      http_status: whRes.status,
      ...whBody,
      scheduled_jobs: jobs.map((j) => ({
        message_type: j.message_type,
        scheduled_for: j.scheduled_for,
      })),
      next_step: pass
        ? 'Jobs created via real webhook HTTP — run GET /api/cron to process due messages'
        : `Expected jobs in <${PASS_MS}ms; got ${jobs.length} jobs in ${elapsed_ms}ms`,
    });
  } catch (error) {
    console.error('[TEST-BOOK] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
