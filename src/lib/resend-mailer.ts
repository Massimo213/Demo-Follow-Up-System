/**
 * Resend email sender
 * From: "David" <david@elystra.online>  — verified domain, proper DKIM, inbox delivery
 * Reply-To: GMAIL_USER                  — replies land in the real Gmail inbox
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('RESEND_API_KEY not configured');
  _resend = new Resend(key);
  return _resend;
}

const FROM_ADDRESS = 'David <david@elystra.online>';

export interface ResendMailOptions {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(opts: ResendMailOptions): Promise<{ id: string }> {
  const resend = getResend();
  const replyTo = opts.replyTo ?? process.env.GMAIL_USER?.trim();

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);
  }

  return { id: data!.id };
}
