import crypto from 'crypto';
import type { CalendlyEvent } from '@/types/demo';

const PHONE_QA_KEYWORDS = [
  'phone',
  'cell',
  'mobile',
  'number',
  'sms',
  'text',
  'contact',
];

export type CalendlyInviteeLike = {
  text_reminder_number?: string | null;
  questions_and_answers?: Array<{ question: string; answer: string }> | null;
};

/** Extract raw phone from Calendly invitee fields (webhook + sync). */
export function extractPhoneFromInvitee(invitee: CalendlyInviteeLike): string | null {
  const reminder = invitee.text_reminder_number?.trim();
  if (reminder) return reminder;

  for (const qa of invitee.questions_and_answers ?? []) {
    const q = qa.question.toLowerCase();
    if (PHONE_QA_KEYWORDS.some((k) => q.includes(k)) && qa.answer?.trim()) {
      return qa.answer.trim();
    }
  }
  return null;
}

/**
 * Calendly webhook signing secret must NOT be the API PAT.
 * Returns an error message when misconfigured, otherwise null.
 */
export function calendlySecretMisconfig(): string | null {
  const webhookSecret = (process.env.CALENDLY_WEBHOOK_SECRET ?? '').trim();
  const apiToken = (process.env.CALENDLY_API_TOKEN ?? '').trim();
  if (!webhookSecret || !apiToken) return null;
  if (webhookSecret === apiToken) {
    return 'CALENDLY_WEBHOOK_SECRET must not equal CALENDLY_API_TOKEN';
  }
  return null;
}

/**
 * Verify Calendly webhook signature (HMAC-SHA256).
 * https://developer.calendly.com/api-docs/dcb40d6d4c8e5-webhook-signature-verification
 */
export function verifyCalendlyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(',');
  let t = '';
  let v1 = '';
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === 't') t = value;
    if (key === 'v1') v1 = value;
  }
  if (!t || !v1) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Build a synthetic invitee.created payload for tests. */
export function buildCalendlyWebhookEvent(opts: {
  email: string;
  name?: string;
  scheduledAt: string;
  eventUuid?: string;
  inviteeUuid?: string;
  phone?: string | null;
  joinUrl?: string;
  timezone?: string;
}): CalendlyEvent {
  const eventUuid = opts.eventUuid ?? crypto.randomUUID();
  const inviteeUuid = opts.inviteeUuid ?? crypto.randomUUID();
  const now = new Date().toISOString();

  return {
    event: 'invitee.created',
    payload: {
      event: 'invitee.created',
      created_at: now,
      invitee: {
        uuid: inviteeUuid,
        email: opts.email,
        name: opts.name ?? 'Test User',
        timezone: opts.timezone ?? 'America/New_York',
        created_at: now,
        text_reminder_number: opts.phone ?? undefined,
      },
      scheduled_event: {
        uuid: eventUuid,
        start_time: opts.scheduledAt,
        end_time: new Date(new Date(opts.scheduledAt).getTime() + 30 * 60 * 1000).toISOString(),
        created_at: now,
        location: { join_url: opts.joinUrl ?? 'https://zoom.us/j/test123456789' },
      },
      questions_and_answers: opts.phone
        ? [{ question: 'Phone number', answer: opts.phone }]
        : undefined,
    },
  };
}
