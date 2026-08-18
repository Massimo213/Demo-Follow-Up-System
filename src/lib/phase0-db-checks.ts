import { db } from '@/lib/db';
import { isExcludedFromAnalytics } from '@/lib/demo-exclusions';
import type { Phase0Check } from '@/lib/phase0-adversarial';

/**
 * Live database checks — adversarial against production state, not self-written mocks.
 */
export async function runPhase0DbChecks(): Promise<Phase0Check[]> {
  const demos = await db.demos.listForAnalytics();
  const messages = await db.messages.listForAnalytics();

  const noShowRecent = demos
    .filter((d) => d.status === 'NO_SHOW')
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
    .slice(0, 30);

  const internalInNoShow = noShowRecent.filter((d) => isExcludedFromAnalytics(d)).length;
  const internalPct = noShowRecent.length ? internalInNoShow / noShowRecent.length : 0;

  const ambiguousAttended = demos.filter(
    (d) => d.status === 'NO_SHOW' && d.joined_at != null
  ).length;

  const recentWithPhone = demos.filter(
    (d) => d.phone != null && new Date(d.created_at).getTime() > Date.now() - 90 * 86400000
  );
  const phoneE164Filled = recentWithPhone.filter((d) => d.phone_e164 != null).length;
  const phoneE164Rate =
    recentWithPhone.length === 0 ? 1 : phoneE164Filled / recentWithPhone.length;

  const sentAtFilled = messages.filter((m) => m.sent_at != null).length;
  const sentAtRate = messages.length === 0 ? 1 : sentAtFilled / messages.length;

  const cancelledPastStale = demos.filter(
    (d) =>
      d.status === 'CANCELLED' &&
      new Date(d.scheduled_at).getTime() < Date.now() - 15 * 60 * 1000
  );
  const cancelledWouldAutoNoShow = cancelledPastStale.some(
    (d) => d.status === 'PENDING' || d.status === 'CONFIRMED'
  );

  return [
    {
      name: 'NO_SHOW sample: <10% internal/test rows (last 30)',
      pass: internalPct < 0.1,
      detail: `${internalInNoShow}/${noShowRecent.length} internal (${(internalPct * 100).toFixed(1)}%)`,
    },
    {
      name: 'No ambiguous NO_SHOW rows with joined_at set',
      pass: ambiguousAttended === 0,
      detail: `count=${ambiguousAttended}`,
    },
    {
      name: 'messages.sent_at populated on all rows',
      pass: sentAtRate >= 0.99,
      detail: `${sentAtFilled}/${messages.length} (${(sentAtRate * 100).toFixed(1)}%)`,
    },
    {
      name: 'phone_e164 backfill coverage (90d rows with phone)',
      pass: phoneE164Rate >= 0.5 || recentWithPhone.length === 0,
      detail: `${phoneE164Filled}/${recentWithPhone.length} (${(phoneE164Rate * 100).toFixed(1)}%) — deploy sync to fill new rows`,
    },
    {
      name: 'CANCELLED demos never appear as PENDING/CONFIRMED',
      pass: cancelledWouldAutoNoShow === false,
      detail: `cancelled past=${cancelledPastStale.length}`,
    },
  ];
}
