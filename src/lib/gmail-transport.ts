/**
 * Hardened Gmail SMTP transport.
 *
 * Why this exists:
 * Gmail intermittently rejects App-Password logins from cloud/serverless IPs with
 * `535-5.7.8 Username and Password not accepted` (anti-abuse on unfamiliar IPs /
 * burst volume). The credentials are valid — the same login succeeds minutes later.
 *
 * Strategy to make 535 a non-event:
 * 1. Sanitize credentials (strip stray whitespace/newlines that produce false 535s).
 * 2. Explicit SMTP over 465 with sane timeouts; reconnect on failure.
 * 3. Retry transient failures in-process with backoff, rebuilding the connection.
 * The cron layer additionally treats transient errors as non-permanent so a touchpoint
 * is never silently cancelled — it just sends on the next tick.
 */

import nodemailer from 'nodemailer';
import type { SendMailOptions, SentMessageInfo } from 'nodemailer';

let _transporter: nodemailer.Transporter | null = null;

function readCreds(): { user: string; pass: string } {
  // Strip surrounding whitespace/newlines. App passwords are 16 chars with no
  // internal spaces, so removing all whitespace is safe and fixes copy/paste artifacts.
  const user = (process.env.GMAIL_USER ?? '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '');
  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD not configured');
  }
  return { user, pass };
}

export function getGmailTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  const { user, pass } = readCreds();
  _transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return _transporter;
}

/** Drop the cached connection so the next send authenticates fresh. */
export function resetGmailTransporter(): void {
  try {
    _transporter?.close();
  } catch {
    /* ignore */
  }
  _transporter = null;
}

/**
 * True for errors that are worth retrying: Gmail anti-abuse auth rejections (535),
 * SMTP 4xx greylisting/rate limits, and network/socket blips. NOT for hard failures
 * like invalid recipient (550) or a missing template.
 */
export function isTransientSendError(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number; message?: string } | undefined;
  if (!e) return false;

  const code = e.responseCode;
  // SMTP 4xx are explicitly temporary per RFC 5321.
  if (typeof code === 'number' && code >= 400 && code < 500) return true;

  const msg = `${e.code ?? ''} ${e.message ?? ''}`.toLowerCase();
  const transientNeedles = [
    '535', // Gmail BadCredentials anti-abuse rejection (intermittent on cloud IPs)
    '454', // temporary auth failure
    '421', // service not available / try later
    '4.7.0',
    '4.7.5',
    'invalid login',
    'badcredentials',
    'too many',
    'rate',
    'timeout',
    'timed out',
    'etimedout',
    'econnreset',
    'econnrefused',
    'esocket',
    'socket close',
    'connection closed',
    'eai_again',
    'enotfound',
    'dns',
    'greeting never received',
  ];
  return transientNeedles.some((n) => msg.includes(n));
}

/**
 * Send with bounded retries + exponential backoff. On a transient failure the
 * pooled connection is reset so the retry authenticates from scratch (often enough
 * to clear a one-off Gmail 535).
 */
export async function sendMailWithRetry(
  mailOptions: SendMailOptions,
  attempts = 3
): Promise<SentMessageInfo> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const transporter = getGmailTransporter();
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      lastErr = err;
      const transient = isTransientSendError(err);
      // Always rebuild the connection after a failure; a stale/blocked socket
      // is the most common cause of a repeat 535.
      resetGmailTransporter();
      if (!transient || attempt === attempts) break;
      const delayMs = 1_000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s…
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
