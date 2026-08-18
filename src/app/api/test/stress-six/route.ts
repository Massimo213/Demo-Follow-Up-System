/**
 * Six-horizon stress test — creates real demos + jobs, fires cron, returns audit.
 * Tests what the prospect actually receives (Resend + Twilio), not Calendly UI.
 *
 * POST /api/test/stress-six
 * Auth: Bearer DEMO_ORGANIZER_SECRET
 * Body (optional): { "email": "...", "phone": "+1..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildCalendlyWebhookEvent } from '@/lib/calendly';
import { CalendlyIngestService } from '@/services/calendly-ingest.service';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HORIZONS = [
  { id: 'A45m', label: 'SAME_DAY tight (45m)', hours: 45 / 60 },
  { id: 'B6h', label: 'SAME_DAY wide (6h)', hours: 6 },
  { id: 'C24h', label: 'NEXT_DAY (~24h)', hours: 24 },
  { id: 'D3d', label: 'FUTURE short (3d)', hours: 72 },
  { id: 'E7d', label: 'FUTURE mid (7d)', hours: 168 },
  { id: 'F14d', label: 'FUTURE long (14d)', hours: 336 },
];

const EXPECTED: Record<string, string[]> = {
  SAME_DAY: ['CONFIRM_INITIAL', 'SMS_REMINDER', 'JOIN_LINK'],
  NEXT_DAY: ['CONFIRM_INITIAL', 'CONFIRM_REMINDER', 'SMS_REMINDER', 'JOIN_LINK'],
  FUTURE: ['CONFIRM_INITIAL', 'SMS_DAY_BEFORE', 'DAY_OF_REMINDER', 'SMS_REMINDER', 'JOIN_LINK'],
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.DEMO_ORGANIZER_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function stressEmail(base: string, id: string): string {
  const [local, domain] = base.split('@');
  return `${local}+stress${id.toLowerCase()}@${domain}`;
}

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const baseEmail = (body.email as string) || 'elystrawalkthrough@gmail.com';
  const phone = (body.phone as string) || '+14385271026';
  const now = Date.now();
  const appUrl = config.app.url.replace(/\/$/, '');
  const rows: Record<string, unknown>[] = [];

  for (const h of HORIZONS) {
    const scheduledAt = new Date(now + h.hours * 60 * 60 * 1000).toISOString();
    const email = stressEmail(baseEmail, h.id);
    const eventUuid = `stress-${h.id.toLowerCase()}-${Date.now()}`;

    const event = buildCalendlyWebhookEvent({
      email,
      name: `Stress ${h.id}`,
      scheduledAt,
      phone,
      eventUuid,
      joinUrl: 'https://zoom.us/j/stress-test-join',
    });

    const ingest = await CalendlyIngestService.processInviteeCreated(event);

    rows.push({
      booking: h.id,
      horizon: h.label,
      email,
      scheduled_at: scheduledAt,
      demo_id: ingest.demo_id,
      demo_type: ingest.demo_type,
      jobs_scheduled: ingest.jobs_scheduled,
      expected_sequence: EXPECTED[ingest.demo_type] ?? [],
    });
  }

  // Fire cron twice to process confirm emails (and any compacted steps)
  let cron: Record<string, unknown> = {};
  for (let i = 0; i < 2; i++) {
    const res = await fetch(`${appUrl}/api/cron`);
    cron = await res.json();
  }

  await new Promise((r) => setTimeout(r, 3000));

  const sb = supabase();
  const spreadsheet = [];

  for (const row of rows) {
    const email = row.email as string;
    const { data: demo } = await sb
      .from('demos')
      .select('id, demo_type, scheduled_at, ingest_path')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const demoId = demo?.id ?? (row.demo_id as string);
    const { data: jobs } = await sb
      .from('scheduled_jobs')
      .select('message_type, scheduled_for, executed, cancelled, last_error')
      .eq('demo_id', demoId)
      .order('scheduled_for', { ascending: true });

    const { data: messages } = await sb
      .from('messages')
      .select('message_type, channel, sent_at')
      .eq('demo_id', demoId)
      .order('sent_at', { ascending: true });

    const sent = messages ?? [];
    const pendingJobs = (jobs ?? []).filter((j) => !j.executed && !j.cancelled);

    spreadsheet.push({
      booking: row.booking,
      horizon: row.horizon,
      email,
      scheduled_at: demo?.scheduled_at ?? row.scheduled_at,
      demo_type: demo?.demo_type ?? row.demo_type,
      confirm_email: sent.some((m) => m.message_type === 'CONFIRM_INITIAL' && m.channel === 'EMAIL')
        ? 'YES'
        : 'NO',
      confirm_sms: sent.some((m) => m.message_type === 'CONFIRM_INITIAL' && m.channel === 'SMS')
        ? 'YES'
        : 'NO — system has no confirm SMS step',
      t24h_sms: sent.some((m) => m.message_type === 'SMS_DAY_BEFORE') ? 'YES' : 'pending',
      t4h_email: sent.some((m) =>
        ['CONFIRM_REMINDER', 'DAY_OF_REMINDER'].includes(m.message_type)
      )
        ? 'YES'
        : 'pending',
      t30m_sms: sent.some((m) => m.message_type === 'SMS_REMINDER') ? 'YES' : 'pending',
      t10m_email: sent.some((m) => m.message_type === 'JOIN_LINK') ? 'YES' : 'pending',
      join_url_in_messages: sent.some((m) => m.message_type === 'JOIN_LINK') ? 'YES' : 'pending',
      jobs_pending: pendingJobs.map((j) => ({
        type: j.message_type,
        at: j.scheduled_for,
      })),
      messages_sent: sent.map((m) => ({
        at: m.sent_at,
        channel: m.channel,
        type: m.message_type,
      })),
      expected_sequence: row.expected_sequence,
    });
  }

  const confirmCount = spreadsheet.filter((r) => r.confirm_email === 'YES').length;

  return NextResponse.json({
    status: confirmCount === 6 ? 'pass_confirm' : 'partial',
    run_at: new Date().toISOString(),
    phone,
    base_email: baseEmail,
    note: 'Real emails/SMS sent via Resend/Twilio. Check inbox + phone. Remaining steps fire at scheduled times if cron keeps running.',
    confirm_emails_sent: `${confirmCount}/6`,
    cron_summary: {
      processed: cron.processed,
      errors: cron.errors,
    },
    spreadsheet,
  });
}
