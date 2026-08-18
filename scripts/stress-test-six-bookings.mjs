#!/usr/bin/env node
/**
 * Six-booking horizon stress test.
 * Books via Calendly Scheduling API, syncs ingest, runs cron, audits DB jobs/messages.
 *
 * Usage: node --env-file=/tmp/stress-test.env scripts/stress-test-six-bookings.mjs
 * Requires CALENDLY_API_TOKEN in env (production PAT).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PAT = (process.env.CALENDLY_API_TOKEN ?? '').trim();
const EVENT_TYPE = 'https://api.calendly.com/event_types/db389f3a-8f7e-4a44-be21-901a27809a6d';
const APP_URL = (process.env.APP_URL ?? 'https://demo-followup.vercel.app').trim().replace(/\/$/, '');
const BASE_EMAIL = process.env.STRESS_EMAIL ?? 'elystrawalkthrough@gmail.com';
const PHONE = process.env.STRESS_PHONE ?? '+14385271026';
const TZ = 'America/New_York';

const BOOKINGS = [
  { id: 'A45m', label: 'SAME_DAY tight (45m)', hours: 45 / 60, expectedType: 'SAME_DAY' },
  { id: 'B6h', label: 'SAME_DAY wide (6h)', hours: 6, expectedType: 'SAME_DAY' },
  { id: 'C24h', label: 'NEXT_DAY (~24h)', hours: 24, expectedType: 'NEXT_DAY' },
  { id: 'D3d', label: 'FUTURE short (3d)', hours: 72, expectedType: 'FUTURE' },
  { id: 'E7d', label: 'FUTURE mid (7d)', hours: 168, expectedType: 'FUTURE' },
  { id: 'F14d', label: 'FUTURE long (14d)', hours: 336, expectedType: 'FUTURE' },
];

const EXPECTED = {
  SAME_DAY: ['CONFIRM_INITIAL', 'SMS_REMINDER', 'JOIN_LINK'],
  NEXT_DAY: ['CONFIRM_INITIAL', 'CONFIRM_REMINDER', 'SMS_REMINDER', 'JOIN_LINK'],
  FUTURE: ['CONFIRM_INITIAL', 'SMS_DAY_BEFORE', 'DAY_OF_REMINDER', 'SMS_REMINDER', 'JOIN_LINK'],
};

async function calendly(path, init = {}) {
  const res = await fetch(`https://api.calendly.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function emailFor(id) {
  const [local, domain] = BASE_EMAIL.split('@');
  return `${local}+stress${id.toLowerCase()}@${domain}`;
}

function roundToNextSlot(iso) {
  const d = new Date(iso);
  d.setUTCSeconds(0, 0);
  const min = d.getUTCMinutes();
  d.setUTCMinutes(min + (15 - (min % 15)) % 15);
  return d.toISOString().replace('.000Z', 'Z');
}

async function findSlot(targetMs) {
  const start = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const end = new Date(Math.max(targetMs, Date.now()) + 3 * 24 * 60 * 60 * 1000).toISOString();
  const q = new URLSearchParams({
    event_type: EVENT_TYPE,
    start_time: start,
    end_time: end,
  });
  const { ok, body } = await calendly(`/event_type_available_times?${q}`);
  if (!ok) throw new Error(`availability ${JSON.stringify(body)}`);
  const slots = body.collection ?? [];
  if (!slots.length) return null;
  let best = null;
  let bestDiff = Infinity;
  for (const s of slots) {
    const diff = Math.abs(new Date(s.start_time).getTime() - targetMs);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best?.start_time ?? null;
}

async function bookSlot(spec, startTime) {
  const email = emailFor(spec.id);
  const payload = {
    event_type: EVENT_TYPE,
    start_time: startTime,
    invitee: {
      name: `Stress Test ${spec.id}`,
      email,
      timezone: TZ,
      text_reminder_number: PHONE,
    },
    booking_source: 'api_stress_test',
  };
  const { ok, status, body } = await calendly('/invitees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ok, status, body, email, startTime };
}

async function triggerSync() {
  const res = await fetch(`${APP_URL}/api/sync/calendly`);
  return res.json();
}

async function triggerCron() {
  const res = await fetch(`${APP_URL}/api/cron`);
  return res.json();
}

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

async function auditDemo(sb, email) {
  const { data: demo } = await sb
    .from('demos')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!demo) return { email, found: false };

  const { data: jobs } = await sb
    .from('scheduled_jobs')
    .select('message_type, scheduled_for, executed, cancelled, last_error')
    .eq('demo_id', demo.id)
    .order('scheduled_for', { ascending: true });

  const { data: messages } = await sb
    .from('messages')
    .select('message_type, channel, sent_at')
    .eq('demo_id', demo.id)
    .order('sent_at', { ascending: true });

  return {
    email,
    found: true,
    demo_id: demo.id,
    demo_type: demo.demo_type,
    ingest_path: demo.ingest_path,
    scheduled_at: demo.scheduled_at,
    status: demo.status,
    jobs: jobs ?? [],
    messages: messages ?? [],
  };
}

async function main() {
  if (!PAT) throw new Error('Missing CALENDLY_API_TOKEN');
  if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL');

  const now = Date.now();
  const results = [];

  console.log('=== STRESS TEST: 6 BOOKINGS ===\n');

  for (const spec of BOOKINGS) {
    const targetMs = now + spec.hours * 60 * 60 * 1000;
    console.log(`\n--- ${spec.id}: ${spec.label} ---`);
    let startTime;
    try {
      startTime = await findSlot(targetMs);
      if (!startTime) {
        results.push({ ...spec, status: 'NO_SLOT', error: 'No Calendly availability near target' });
        console.log('NO SLOT near target');
        continue;
      }
      console.log('Target slot:', startTime);
      const booked = await bookSlot(spec, startTime);
      if (!booked.ok) {
        results.push({
          ...spec,
          status: 'BOOK_FAIL',
          error: booked.body,
          http: booked.status,
          slot: startTime,
        });
        console.log('BOOK FAIL', booked.status, JSON.stringify(booked.body));
        continue;
      }
      const eventUuid = booked.body?.resource?.event?.split('/').pop?.() ?? null;
      results.push({
        ...spec,
        status: 'BOOKED',
        email: booked.email,
        slot: booked.startTime,
        event_uuid: eventUuid,
        invitee_uri: booked.body?.resource?.uri,
      });
      console.log('BOOKED', booked.email, eventUuid);
    } catch (e) {
      results.push({ ...spec, status: 'ERROR', error: String(e) });
      console.log('ERROR', e.message);
    }
  }

  console.log('\n=== SYNC + CRON ===');
  const sync = await triggerSync();
  console.log('sync:', JSON.stringify(sync));
  const cron = await triggerCron();
  console.log('cron:', JSON.stringify({ processed: cron.processed, errors: cron.errors?.length }));

  console.log('\n=== DB AUDIT (5s wait) ===');
  await new Promise((r) => setTimeout(r, 5000));
  await triggerSync();
  await triggerCron();

  const sb = supabase();
  const audits = [];
  for (const r of results.filter((x) => x.email)) {
    const audit = await auditDemo(sb, r.email);
    audits.push({ ...r, audit });
    const expected = EXPECTED[r.expectedType] ?? [];
    const jobTypes = (audit.jobs ?? []).filter((j) => !j.cancelled).map((j) => j.message_type);
    const sent = (audit.messages ?? []).map((m) => `${m.channel}:${m.message_type}@${m.sent_at}`);
    console.log(`\n${r.id} ${r.email}`);
    console.log('  ingest:', audit.ingest_path, 'type:', audit.demo_type, 'found:', audit.found);
    console.log('  jobs:', jobTypes.join(', ') || '(none)');
    console.log('  expected:', expected.join(', '));
    console.log('  sent:', sent.join(' | ') || '(none yet)');
    console.log(
      '  confirm_email:',
      sent.some((s) => s.includes('CONFIRM_INITIAL')) ? 'YES' : 'NO'
    );
  }

  const report = {
    run_at: new Date().toISOString(),
    app_url: APP_URL,
    phone: PHONE,
    bookings: results,
    audits,
    sync,
    cron_summary: { processed: cron.processed, error_count: cron.errors?.length ?? 0 },
  };

  const outPath = join(__dirname, '..', 'stress-test-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${outPath}`);

  const booked = results.filter((r) => r.status === 'BOOKED').length;
  const ingested = audits.filter((a) => a.audit?.found).length;
  const confirmSent = audits.filter((a) =>
    (a.audit?.messages ?? []).some((m) => m.message_type === 'CONFIRM_INITIAL')
  ).length;

  console.log('\n=== SCORECARD ===');
  console.log(`Booked on Calendly: ${booked}/6`);
  console.log(`Ingested in DB:     ${ingested}/${booked}`);
  console.log(`Confirm email sent: ${confirmSent}/${ingested}`);
  process.exit(booked === 6 && ingested === booked && confirmSent === ingested ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
