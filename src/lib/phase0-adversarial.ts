import {
  canOrganizerCorrectAttendance,
  horizonBucket,
  isLateMessage,
  shouldAutoNoShow,
  showRate,
} from '@/lib/phase0-rules';
import { isExcludedFromAnalytics } from '@/lib/demo-exclusions';
import { ReplyService } from '@/services/reply.service';

export type Phase0Check = { name: string; pass: boolean; detail: string };

/**
 * Encodes the adversarial cases from the Phase 0 spec.
 * Run via GET /api/organizer/phase0-checks.
 */
export function runPhase0AdversarialChecks(nowMs = Date.now()): Phase0Check[] {
  const t0 = nowMs;

  const joinedThenAuto = shouldAutoNoShow(
    {
      status: 'COMPLETED',
      joined_at: new Date(t0 - 30_000).toISOString(),
      scheduled_at: new Date(t0 - 12 * 60 * 1000 - 30_000).toISOString(),
    },
    t0
  );

  const autoThenOrganizerStillNoShowRow = shouldAutoNoShow(
    {
      status: 'NO_SHOW',
      joined_at: null,
      scheduled_at: new Date(t0 - 17 * 60 * 1000).toISOString(),
    },
    t0
  );
  const organizerCanOverrideAt17m = canOrganizerCorrectAttendance(
    { status: 'NO_SHOW', scheduled_at: new Date(t0 - 17 * 60 * 1000).toISOString() },
    t0
  );
  const organizerCanOverrideAt45m = canOrganizerCorrectAttendance(
    { status: 'NO_SHOW', scheduled_at: new Date(t0 - 45 * 60 * 1000).toISOString() },
    t0
  );

  const cancelled = shouldAutoNoShow(
    {
      status: 'CANCELLED',
      joined_at: null,
      scheduled_at: new Date(t0 - 20 * 60 * 1000).toISOString(),
    },
    t0
  );

  const rescheduled = shouldAutoNoShow(
    {
      status: 'RESCHEDULED',
      joined_at: null,
      scheduled_at: new Date(t0 - 20 * 60 * 1000).toISOString(),
    },
    t0
  );

  const exactly12m = shouldAutoNoShow(
    {
      status: 'PENDING',
      joined_at: null,
      scheduled_at: new Date(t0 - 12 * 60 * 1000).toISOString(),
    },
    t0
  );

  const justOver12m = shouldAutoNoShow(
    {
      status: 'PENDING',
      joined_at: null,
      scheduled_at: new Date(t0 - 12 * 60 * 1000 - 1).toISOString(),
    },
    t0
  );

  const cancelledBackfill = shouldAutoNoShow(
    {
      status: 'CANCELLED',
      joined_at: null,
      scheduled_at: new Date(t0 - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    t0
  );

  const allCancelledShowRate = showRate(0, 0);

  const bucket4h = horizonBucket(4);
  const bucketJustUnder4 = horizonBucket(3.999);
  const bucket075 = horizonBucket(0.75);

  const late2s = isLateMessage(
    new Date(t0 + 2000).toISOString(),
    new Date(t0).toISOString()
  );
  const onTime = isLateMessage(
    new Date(t0).toISOString(),
    new Date(t0).toISOString()
  );

  const internalExcluded = isExcludedFromAnalytics({
    calendly_event_id: 'abc123',
    email: 'elystrahelpmeteam@gmail.com',
    ingest_path: 'sync',
  });
  const realProspectIncluded = !isExcludedFromAnalytics({
    calendly_event_id: 'abc123',
    email: 'prospect@acme.com',
    ingest_path: 'sync',
  });

  const metric32pct = ReplyService.parseFocusMetric('32%');
  const metricCloseRate = ReplyService.parseFocusMetric('close rate');
  const metricYesNotMetric = ReplyService.parseFocusMetric('YES');

  const upcomingNoButtons = !canOrganizerCorrectAttendance(
    { status: 'PENDING', scheduled_at: new Date(t0 + 60 * 60 * 1000).toISOString() },
    t0
  );

  return [
    {
      name: 'Joined then auto-NO_SHOW 30s later does not override organizer',
      pass: joinedThenAuto === false,
      detail: `shouldAutoNoShow=${joinedThenAuto} (expected false when joined_at set / COMPLETED)`,
    },
    {
      name: 'Auto-NO_SHOW row does not re-fire; organizer can correct at T+17m',
      pass: autoThenOrganizerStillNoShowRow === false && organizerCanOverrideAt17m === true,
      detail: `auto=${autoThenOrganizerStillNoShowRow}; canCorrect@17m=${organizerCanOverrideAt17m}`,
    },
    {
      name: 'Organizer can correct NO_SHOW at T+45m (no time gate on truth)',
      pass: organizerCanOverrideAt45m === true,
      detail: `canCorrect@45m=${organizerCanOverrideAt45m}`,
    },
    {
      name: 'Upcoming demo has no correction buttons until meeting starts',
      pass: upcomingNoButtons === true,
      detail: `canCorrect future=${!upcomingNoButtons}`,
    },
    {
      name: 'Cancelled before meeting time does not become NO_SHOW at T+12m',
      pass: cancelled === false,
      detail: `shouldAutoNoShow=${cancelled}`,
    },
    {
      name: 'Rescheduled old slot does not become NO_SHOW',
      pass: rescheduled === false,
      detail: `shouldAutoNoShow=${rescheduled}`,
    },
    {
      name: 'scheduled_at exactly 12 minutes ago waits one more sweep',
      pass: exactly12m === false && justOver12m === true,
      detail: `exact12m=${exactly12m} justOver=${justOver12m} (strict <)`,
    },
    {
      name: 'Backfill does not touch CANCELLED',
      pass: cancelledBackfill === false,
      detail: `shouldAutoNoShow=${cancelledBackfill}`,
    },
    {
      name: 'Show rate with zero kept displays null (UI renders —)',
      pass: allCancelledShowRate === null,
      detail: `showRate(0,0)=${String(allCancelledShowRate)}`,
    },
    {
      name: 'Horizon exactly 4.00h is 4–12h (lower inclusive)',
      pass: bucket4h === '4–12h' && bucketJustUnder4 === '0.75–4h' && bucket075 === '0.75–4h',
      detail: `4.00=${bucket4h} 3.999=${bucketJustUnder4} 0.75=${bucket075}`,
    },
    {
      name: 'sent_at 2 seconds after scheduled_at is red (zero tolerance)',
      pass: late2s === true && onTime === false,
      detail: `late2s=${late2s} exact=${onTime}`,
    },
    {
      name: 'Internal QA email excluded from analytics cohort',
      pass: internalExcluded === true && realProspectIncluded === true,
      detail: `internal=${internalExcluded} prospect=${realProspectIncluded}`,
    },
    {
      name: 'SMS "32%" parses as close_rate focus metric',
      pass: metric32pct === 'close_rate' && metricCloseRate === 'close_rate' && metricYesNotMetric === null,
      detail: `32%=${metric32pct} close rate=${metricCloseRate} YES=${metricYesNotMetric}`,
    },
  ];
}
