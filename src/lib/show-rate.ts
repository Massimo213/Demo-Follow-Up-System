import type { Demo, DemoStatus, Message } from '@/types/demo';
import {
  HORIZON_ORDER,
  STALE_PENDING_ALERT_MS,
  computeHorizonHours,
  horizonBucket,
  INGEST_FAST_SECONDS,
  isLateMessage,
  isStalePendingAlert,
  showRate as showRateFn,
  type HorizonBucket,
} from '@/lib/phase0-rules';

export { computeHorizonHours, horizonBucket, HORIZON_ORDER };
export type { HorizonBucket };

export const UNRESOLVED_GRACE_MS = STALE_PENDING_ALERT_MS;

export type AnalyticsWindow = '7d' | '14d' | '30d' | '90d';

export type UnresolvedDemo = {
  id: string;
  name: string;
  email: string;
  scheduled_at: string;
  status: DemoStatus;
  timezone: string;
};

/** Past kept demos in the cohort — organizer can flip Joined / No-Show from Analytics. */
export type CorrectionDemo = UnresolvedDemo & {
  joined_at: string | null;
};

export type RateRow = {
  key: string;
  booked: number;
  kept: number;
  attended: number;
  no_show: number;
  unresolved: number;
  confirmed: number;
  cancelled: number;
  rescheduled: number;
  show_rate: number | null;
  no_show_rate: number | null;
  confirmation_rate: number | null;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  conversion_from_prev: number | null;
  late_count: number;
  red: boolean;
};

export type ShowRateReport = {
  generated_at: string;
  window: AnalyticsWindow;
  unresolved_grace_minutes: number;
  headline: RateRow;
  by_horizon: RateRow[];
  funnel: FunnelStep[];
  unresolved: UnresolvedDemo[];
  stale_alert_count: number;
  /** Kept + past meeting time in this window — for 1-click attendance fixes. */
  correction_demos: CorrectionDemo[];
};

export function windowStartMs(window: AnalyticsWindow, nowMs: number): number {
  const days = window === '7d' ? 7 : window === '14d' ? 14 : window === '90d' ? 90 : 30;
  return nowMs - days * 24 * 60 * 60 * 1000;
}

import { isExcludedFromAnalytics } from '@/lib/demo-exclusions';

export function isTestDemo(d: Pick<Demo, 'calendly_event_id' | 'email' | 'ingest_path'>): boolean {
  return isExcludedFromAnalytics(d);
}

function isKept(status: DemoStatus): boolean {
  return status !== 'CANCELLED' && status !== 'RESCHEDULED';
}

function isAttended(d: Pick<Demo, 'status' | 'joined_at'>): boolean {
  // Status wins — never count NO_SHOW as attended even if joined_at is stale/ambiguous.
  if (d.status === 'NO_SHOW') return false;
  return d.status === 'COMPLETED' || !!d.joined_at;
}

export function isUnresolvedPast(
  d: Pick<Demo, 'status' | 'scheduled_at' | 'joined_at'>,
  nowMs: number
): boolean {
  return isStalePendingAlert(d, nowMs);
}

function emptyRow(key: string): RateRow {
  return {
    key,
    booked: 0,
    kept: 0,
    attended: 0,
    no_show: 0,
    unresolved: 0,
    confirmed: 0,
    cancelled: 0,
    rescheduled: 0,
    show_rate: null,
    no_show_rate: null,
    confirmation_rate: null,
  };
}

function finishRow(row: RateRow): RateRow {
  row.show_rate = showRateFn(row.attended, row.kept);
  row.no_show_rate = row.show_rate == null ? null : 1 - row.show_rate;
  row.confirmation_rate = showRateFn(row.confirmed, row.kept);
  return row;
}

function rowWasAttended(d: Pick<Demo, 'status' | 'joined_at'>): boolean {
  if (d.status === 'NO_SHOW') return false;
  return d.status === 'COMPLETED' || !!d.joined_at;
}

/** Optimistic analytics refresh after organizer attendance PATCH. */
export function applyAttendanceCorrectionToReport(
  report: ShowRateReport,
  demoId: string,
  patch: Pick<Demo, 'status' | 'joined_at'>
): ShowRateReport {
  const idx = report.correction_demos.findIndex((d) => d.id === demoId);
  if (idx < 0) return report;

  const before = report.correction_demos[idx];
  const wasAttended = rowWasAttended(before);
  const willAttend = rowWasAttended(patch);

  const headline = { ...report.headline };
  if (!wasAttended && willAttend) {
    headline.attended += 1;
    if (before.status === 'NO_SHOW') headline.no_show = Math.max(0, headline.no_show - 1);
  } else if (wasAttended && !willAttend && patch.status === 'NO_SHOW') {
    headline.attended = Math.max(0, headline.attended - 1);
    headline.no_show += 1;
  }
  finishRow(headline);

  const correction_demos = report.correction_demos.map((d) =>
    d.id === demoId
      ? { ...d, status: patch.status, joined_at: patch.joined_at ?? null }
      : d
  );

  const funnel = report.funnel.map((step) => {
    if (step.key !== 'joined') return step;
    let count = step.count;
    if (!wasAttended && willAttend) count += 1;
    else if (wasAttended && !willAttend && patch.status === 'NO_SHOW') count = Math.max(0, count - 1);
    return { ...step, count };
  });

  return { ...report, headline, correction_demos, funnel };
}

function bump(row: RateRow, d: Demo, nowMs: number): void {
  row.booked += 1;
  if (d.status === 'CANCELLED') row.cancelled += 1;
  if (d.status === 'RESCHEDULED') row.rescheduled += 1;
  if (!isKept(d.status)) return;
  row.kept += 1;
  if (d.confirmed_at) row.confirmed += 1;
  if (isAttended(d)) row.attended += 1;
  else if (d.status === 'NO_SHOW') row.no_show += 1;
  else if (isUnresolvedPast(d, nowMs)) row.unresolved += 1;
}

function hasType(messages: Message[] | undefined, type: string): boolean {
  return (messages || []).some((m) => m.message_type === type);
}

function lateCount(messages: Message[] | undefined, types: string[], scheduledAt: string): number {
  return (messages || []).filter(
    (m) => types.includes(m.message_type) && isLateMessage(m.sent_at, scheduledAt)
  ).length;
}

export function buildShowRateReport(
  demos: Demo[],
  messagesByDemo: Map<string, Message[]>,
  window: AnalyticsWindow,
  nowMs = Date.now()
): ShowRateReport {
  const start = windowStartMs(window, nowMs);
  const cohort = demos.filter((d) => {
    if (isTestDemo(d)) return false;
    const t = new Date(d.scheduled_at).getTime();
    if (Number.isNaN(t)) return false;
    return t >= start && t <= nowMs;
  });

  const headline = emptyRow('all');
  const byHorizon = new Map<string, RateRow>();
  for (const b of HORIZON_ORDER) byHorizon.set(b, emptyRow(b));
  const unresolved: UnresolvedDemo[] = [];
  const correctionDemos: CorrectionDemo[] = [];

  let ingestFast = 0;
  let t0Email = 0;
  let t0Sms = 0;
  let metric = 0;
  let confirmed = 0;
  let t24 = 0;
  let t30sms = 0;
  let joined = 0;
  let lateT0Email = 0;
  let lateT0Sms = 0;
  let lateT24 = 0;
  let lateT30 = 0;

  for (const d of cohort) {
    bump(headline, d, nowMs);
    const hours =
      d.horizon_hours != null
        ? d.horizon_hours
        : computeHorizonHours(new Date(d.scheduled_at), new Date(d.created_at));
    bump(byHorizon.get(horizonBucket(hours))!, d, nowMs);

    if (isUnresolvedPast(d, nowMs)) {
      unresolved.push({
        id: d.id,
        name: d.name,
        email: d.email,
        scheduled_at: d.scheduled_at,
        status: d.status,
        timezone: d.timezone,
      });
    }

    const scheduledMs = new Date(d.scheduled_at).getTime();
    if (isKept(d.status) && scheduledMs < nowMs) {
      correctionDemos.push({
        id: d.id,
        name: d.name,
        email: d.email,
        scheduled_at: d.scheduled_at,
        status: d.status,
        timezone: d.timezone,
        joined_at: d.joined_at ?? null,
      });
    }

    const msgs = messagesByDemo.get(d.id);
    if (d.ingest_lag_seconds != null && d.ingest_lag_seconds < INGEST_FAST_SECONDS) ingestFast += 1;
    if (hasType(msgs, 'CONFIRM_INITIAL') || hasType(msgs, 'CONFIRM_INITIAL_LOOM')) t0Email += 1;
    if (hasType(msgs, 'SMS_CONFIRM')) t0Sms += 1;
    if (d.focus_metric) metric += 1;
    if (d.confirmed_at) confirmed += 1;
    if (hasType(msgs, 'SMS_DAY_BEFORE')) t24 += 1;
    if (hasType(msgs, 'SMS_REMINDER')) t30sms += 1;
    if (isAttended(d)) joined += 1;

    lateT0Email += lateCount(msgs, ['CONFIRM_INITIAL', 'CONFIRM_INITIAL_LOOM'], d.scheduled_at);
    lateT0Sms += lateCount(msgs, ['SMS_CONFIRM'], d.scheduled_at);
    lateT24 += lateCount(msgs, ['SMS_DAY_BEFORE'], d.scheduled_at);
    lateT30 += lateCount(msgs, ['SMS_REMINDER'], d.scheduled_at);
  }

  unresolved.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  correctionDemos.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  const booked = cohort.length;
  const funnelCounts = [booked, ingestFast, t0Email, t0Sms, metric, confirmed, t24, t30sms, joined];
  const funnelLate = [0, 0, lateT0Email, lateT0Sms, 0, 0, lateT24, lateT30, 0];
  const funnelLabels = [
    { key: 'booked', label: 'Booked' },
    { key: 'ingest_fast', label: 'Ingest < 60s' },
    { key: 't0_email', label: 'T+0 Email sent' },
    { key: 't0_sms', label: 'T+0 SMS sent' },
    { key: 'metric', label: 'Metric captured' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 't24h', label: 'T-24h sent' },
    { key: 't45m', label: 'T-45m sent' },
    { key: 'joined', label: 'Joined' },
  ];

  const funnel: FunnelStep[] = funnelLabels.map((step, i) => {
    const count = funnelCounts[i];
    const prev = i === 0 ? null : funnelCounts[i - 1];
    return {
      key: step.key,
      label: step.label,
      count,
      conversion_from_prev: prev == null || prev === 0 ? null : count / prev,
      late_count: funnelLate[i],
      red: funnelLate[i] > 0,
    };
  });

  const staleAlertCount = demos.filter((d) => !isTestDemo(d) && isStalePendingAlert(d, nowMs)).length;

  return {
    generated_at: new Date(nowMs).toISOString(),
    window,
    unresolved_grace_minutes: STALE_PENDING_ALERT_MS / 60000,
    headline: finishRow(headline),
    by_horizon: HORIZON_ORDER.map((k) => finishRow(byHorizon.get(k)!)),
    funnel,
    unresolved,
    stale_alert_count: staleAlertCount,
    correction_demos: correctionDemos,
  };
}
