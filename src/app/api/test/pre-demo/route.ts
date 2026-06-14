/**
 * Pre-Demo System Test
 * Renders and optionally sends every pre-demo touchpoint against a synthetic demo.
 * Bypasses DB writes — no records created, no cleanup needed.
 *
 * GET  /api/test/pre-demo[?demo_type=FUTURE&focus_metric=close_rate]
 *   Public dry-run: renders all templates, returns previews — no sends.
 *
 * POST /api/test/pre-demo
 *   Auth: Bearer DEMO_ORGANIZER_SECRET
 *   Body: { send:true, to_email, to_phone, demo_type, focus_metric }
 *   Live-send mode: actually delivers to to_email / to_phone.
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import Twilio from 'twilio';
import { EmailTemplates } from '@/templates/email';
import { SmsTemplates } from '@/templates/sms';
import { appendEmailTextFooter } from '@/lib/email-signature';
import type { Demo, MessageType } from '@/types/demo';

export const dynamic = 'force-dynamic';

const EMAIL_TYPES: MessageType[] = [
  'CONFIRM_INITIAL',
  'CONFIRM_REMINDER',
  'DAY_OF_REMINDER',
  'JOIN_LINK',
  'POST_NO_SHOW',
];

const SMS_TYPES: MessageType[] = [
  'SMS_CONFIRM',
  'SMS_DAY_BEFORE',
  'CONFIRM_REMINDER',
  'SMS_REMINDER',
  'SMS_URGENT',
];

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.DEMO_ORGANIZER_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function sendTestEmail(to: string, subject: string, html: string, text: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD not configured');
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  await t.sendMail({
    from: `"David from Elystra" <${user}>`,
    to,
    subject: `[TEST] ${subject}`,
    html,
    text: appendEmailTextFooter(text),
    replyTo: user,
  });
}

async function sendTestSms(to: string, body: string) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !auth) throw new Error('TWILIO credentials not configured');
  if (!from)         throw new Error('TWILIO_PHONE_NUMBER not configured');
  const twilio = Twilio(sid, auth);
  await twilio.messages.create({ body: `[TEST] ${body}`, from, to });
}

type TouchpointResult = {
  channel: 'EMAIL' | 'SMS';
  rendered: boolean;
  subject?: string;
  preview: string;
  sent?: boolean;
  error?: string;
};

interface RunOptions {
  shouldSend: boolean;
  demoType: Demo['demo_type'];
  toEmail: string;
  toPhone: string;
  focusMetric: Demo['focus_metric'];
}

async function runTest({ shouldSend, demoType, toEmail, toPhone, focusMetric }: RunOptions) {
  const fakeDemoTime = new Date(Date.now() + 25 * 60 * 60 * 1000);

  const fakeDemo: Demo = {
    id:                  'test-00000000-0000-0000-0000-000000000000',
    calendly_event_id:   'test-event-id',
    calendly_invitee_id: 'test-invitee-id',
    email:               toEmail || 'test@example.com',
    name:                'Sarah Testprospect',
    phone:               toPhone || null,
    scheduled_at:        fakeDemoTime.toISOString(),
    demo_type:           demoType,
    status:              'PENDING',
    join_url:            'https://us06web.zoom.us/j/000000000?pwd=test_link',
    timezone:            'America/New_York',
    confirmed_at:        null,
    joined_at:           null,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
    focus_metric:        focusMetric,
  };

  const results: Record<string, TouchpointResult> = {};

  // ─── EMAIL TOUCHPOINTS ────────────────────────────────────────────────────
  for (const type of EMAIL_TYPES) {
    let tpl;
    try {
      tpl = EmailTemplates.getTemplate(type, fakeDemo);
    } catch (err: any) {
      results[type] = { channel: 'EMAIL', rendered: false, preview: '',
        error: `Render error: ${String(err.message || err).slice(0, 300)}` };
      continue;
    }
    if (!tpl) {
      results[type] = { channel: 'EMAIL', rendered: false, preview: '(no template mapped)' };
      continue;
    }
    results[type] = {
      channel: 'EMAIL', rendered: true, subject: tpl.subject,
      preview: tpl.text.slice(0, 600) + (tpl.text.length > 600 ? '…' : ''),
    };
    if (shouldSend && toEmail) {
      try {
        await sendTestEmail(toEmail, tpl.subject, tpl.html, tpl.text);
        results[type].sent = true;
      } catch (err: any) {
        results[type].sent = false;
        results[type].error = String(err.message || err).slice(0, 400);
      }
    }
  }

  // ─── SMS TOUCHPOINTS ──────────────────────────────────────────────────────
  for (const type of SMS_TYPES) {
    const key = `SMS:${type}`;
    let tpl;
    try {
      tpl = SmsTemplates.getTemplate(type, fakeDemo);
    } catch (err: any) {
      results[key] = { channel: 'SMS', rendered: false, preview: '',
        error: `Render error: ${String(err.message || err).slice(0, 300)}` };
      continue;
    }
    if (!tpl) {
      results[key] = { channel: 'SMS', rendered: false, preview: '(no template mapped)' };
      continue;
    }
    results[key] = { channel: 'SMS', rendered: true, preview: tpl.body };
    if (shouldSend && toPhone) {
      try {
        await sendTestSms(toPhone, tpl.body);
        results[key].sent = true;
      } catch (err: any) {
        results[key].sent = false;
        results[key].error = String(err.message || err).slice(0, 400);
      }
    }
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  const all         = Object.entries(results);
  const renderOk    = all.filter(([, v]) => v.rendered);
  const renderFail  = all.filter(([, v]) => !v.rendered);
  const emailFail   = all.filter(([, v]) => v.channel === 'EMAIL' && v.sent === false);
  const smsFail     = all.filter(([, v]) => v.channel === 'SMS'  && v.sent === false);
  const emailOk     = all.filter(([, v]) => v.channel === 'EMAIL' && v.sent === true);
  const smsOk       = all.filter(([, v]) => v.channel === 'SMS'  && v.sent === true);

  const status =
    renderFail.length > 0                           ? 'TEMPLATE_ERROR'      :
    shouldSend && (emailFail.length + smsFail.length > 0) ? 'SEND_PARTIAL_FAIL' :
    shouldSend                                       ? 'ALL_SENT'            :
                                                       'DRY_RUN_OK';

  return NextResponse.json({
    status,
    mode:         shouldSend ? 'LIVE_SEND' : 'DRY_RUN',
    demo_type:    demoType,
    focus_metric: focusMetric,
    to_email:     toEmail  || '(not provided)',
    to_phone:     toPhone  || '(not provided)',
    summary: {
      templates_total:    all.length,
      templates_rendered: renderOk.length,
      render_errors:      renderFail.map(([k, v]) => ({ type: k, error: v.error })),
      ...(shouldSend ? {
        emails_sent:   emailOk.length,
        emails_failed: emailFail.length,
        sms_sent:      smsOk.length,
        sms_failed:    smsFail.length,
        send_errors: [
          ...emailFail.map(([k, v]) => ({ type: k, error: v.error })),
          ...smsFail.map(([k, v]) => ({ type: k, error: v.error })),
        ],
      } : {
        note: 'Pass "send":true in POST body to actually deliver each touchpoint.',
      }),
    },
    touchpoints: results,
  });
}

// ─── ROUTE HANDLERS ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  return runTest({
    shouldSend:  false,
    demoType:    (p.get('demo_type')    || 'FUTURE') as Demo['demo_type'],
    toEmail:     '',
    toPhone:     '',
    focusMetric: (p.get('focus_metric') || null)     as Demo['focus_metric'],
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  return runTest({
    shouldSend:  b.send === true,
    demoType:    (b.demo_type    || 'FUTURE') as Demo['demo_type'],
    toEmail:     b.to_email      || process.env.GMAIL_USER || '',
    toPhone:     b.to_phone      || '',
    focusMetric: (b.focus_metric ?? null) as Demo['focus_metric'],
  });
}
