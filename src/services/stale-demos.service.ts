import { db } from '@/lib/db';
import { MessagingService } from '@/services/messaging.service';
import { sendMail } from '@/lib/resend-mailer';
import { shouldAutoNoShow, isStalePendingAlert } from '@/lib/phase0-rules';
import type { Demo } from '@/types/demo';

export type ResolveStaleResult = {
  resolved: number;
  still_stale: Demo[];
};

/**
 * Auto-NO_SHOW: PENDING/CONFIRMED, meeting started > 12 minutes ago, no joined_at.
 * Does not touch CANCELLED, RESCHEDULED, or COMPLETED (organizer Joined wins).
 * Exactly 12 minutes ago does not fire (strict <).
 */
export async function resolveStaleDemos(now = new Date()): Promise<ResolveStaleResult> {
  const nowMs = now.getTime();
  const cutoff = new Date(nowMs - 12 * 60 * 1000).toISOString();

  const candidates = await db.demos.findStaleForAutoNoShow(cutoff);
  let resolved = 0;

  for (const demo of candidates) {
    if (!shouldAutoNoShow(demo, nowMs)) continue;
    const updated = await db.demos.markAutoNoShow(demo.id, now.toISOString());
    if (updated) resolved += 1;
  }

  const stillStale = (await db.demos.findStaleForAutoNoShow(new Date(nowMs - 15 * 60 * 1000).toISOString()))
    .filter((d) => isStalePendingAlert(d, nowMs));

  return { resolved, still_stale: stillStale };
}

export async function alertStaleDemos(stale: Demo[]): Promise<void> {
  if (stale.length === 0) return;

  const now = Date.now();
  const last = (globalThis as { __elystraStaleAlertAt?: number }).__elystraStaleAlertAt ?? 0;
  if (now - last < 15 * 60 * 1000) {
    console.log(`[STALE-ALERT] throttled (${stale.length} still stale)`);
    return;
  }
  (globalThis as { __elystraStaleAlertAt?: number }).__elystraStaleAlertAt = now;

  const ownerPhones = (process.env.OWNER_PHONE_NUMBERS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const alertEmails = (process.env.STALE_ALERT_EMAIL ?? process.env.ELYSTRA_TEAM_EMAIL ?? 'elystrateam@gmail.com')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const lines = stale
    .slice(0, 8)
    .map((d) => `${d.name} (${d.email}) ${d.scheduled_at} [${d.status}]`)
    .join('\n');
  const body = `ELYSTRA canary: ${stale.length} demo(s) still PENDING/CONFIRMED >15m after start. Auto-NO_SHOW should have resolved these.\n\n${lines}`;

  if (ownerPhones.length === 0) {
    console.warn('[STALE-ALERT] OWNER_PHONE_NUMBERS not set — SMS skipped');
  }

  for (const phone of ownerPhones) {
    try {
      await MessagingService.sendOpsSms(phone, body);
    } catch (err) {
      console.error('[STALE-ALERT] SMS failed', phone, err);
    }
  }

  for (const email of alertEmails) {
    try {
      await sendMail({
        to: email,
        subject: `ELYSTRA stale demo alert (${stale.length})`,
        text: body,
      });
      console.log(`[STALE-ALERT] Email sent to ${email}`);
    } catch (err) {
      console.error('[STALE-ALERT] Email failed', email, err);
    }
  }
}
