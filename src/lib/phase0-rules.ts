/**
 * Phase 0 measurement rules.
 * Horizon uses fractional hours (not truncated differenceInHours) so 0.75h buckets work.
 * Auto-NO_SHOW uses strict < 12 minutes.
 * Late message: sent_at > scheduled_at with zero tolerance.
 */

export const AUTO_NO_SHOW_AFTER_MS = 12 * 60 * 1000;
export const STALE_PENDING_ALERT_MS = 15 * 60 * 1000;
/** Live-meeting highlight only (optional UI). Corrections are never time-gated. */
export const LIVE_MEETING_WINDOW_BEFORE_MS = 5 * 60 * 1000;
export const LIVE_MEETING_WINDOW_AFTER_MS = 30 * 60 * 1000;
export const INGEST_FAST_SECONDS = 60;

export type HorizonBucket =
  | '<0.75h'
  | '0.75–4h'
  | '4–12h'
  | '12–36h'
  | '36h–7d'
  | '7d+';

export const HORIZON_ORDER: HorizonBucket[] = [
  '<0.75h',
  '0.75–4h',
  '4–12h',
  '12–36h',
  '36h–7d',
  '7d+',
];

/** Fractional hours from ingest → meeting. Immutable after insert. */
export function computeHorizonHours(scheduledAt: Date, ingestAt: Date): number {
  return (scheduledAt.getTime() - ingestAt.getTime()) / 3_600_000;
}

/**
 * Lower bound inclusive, upper exclusive (except last bucket).
 * Exactly 4.00h → 4–12h.
 */
export function horizonBucket(hours: number | null | undefined): HorizonBucket {
  if (hours == null || Number.isNaN(hours)) return '7d+';
  if (hours < 0.75) return '<0.75h';
  if (hours < 4) return '0.75–4h';
  if (hours < 12) return '4–12h';
  if (hours < 36) return '12–36h';
  if (hours < 168) return '36h–7d';
  return '7d+';
}

export function shouldAutoNoShow(input: {
  status: string;
  joined_at: string | null | undefined;
  scheduled_at: string;
}, nowMs: number): boolean {
  if (input.status !== 'PENDING' && input.status !== 'CONFIRMED') return false;
  if (input.joined_at) return false;
  const start = new Date(input.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  return start < nowMs - AUTO_NO_SHOW_AFTER_MS;
}

export function isStalePendingAlert(input: {
  status: string;
  scheduled_at: string;
}, nowMs: number): boolean {
  if (input.status !== 'PENDING' && input.status !== 'CONFIRMED') return false;
  const start = new Date(input.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  return start < nowMs - STALE_PENDING_ALERT_MS;
}

/** During the live meeting window — for optional UI emphasis only. */
export function isLiveMeetingWindow(scheduledAt: string, nowMs: number): boolean {
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return false;
  return (
    nowMs >= start - LIVE_MEETING_WINDOW_BEFORE_MS &&
    nowMs <= start + LIVE_MEETING_WINDOW_AFTER_MS
  );
}

/**
 * Organizer may correct attendance for any past kept demo — no time gate.
 * Human override is the truth; auto-NO_SHOW is only the default.
 */
export function canOrganizerCorrectAttendance(
  input: { status: string; scheduled_at: string },
  nowMs: number
): boolean {
  if (input.status === 'CANCELLED' || input.status === 'RESCHEDULED') return false;
  const start = new Date(input.scheduled_at).getTime();
  if (Number.isNaN(start)) return false;
  return start < nowMs;
}

/** @deprecated Use canOrganizerCorrectAttendance — corrections are not time-gated. */
export function isOrganizerAttendanceWindow(scheduledAt: string, nowMs: number): boolean {
  return canOrganizerCorrectAttendance({ status: 'PENDING', scheduled_at: scheduledAt }, nowMs);
}

/** Zero tolerance: 2 seconds after meeting start is late. */
export function isLateMessage(sentAt: string, scheduledAt: string): boolean {
  return new Date(sentAt).getTime() > new Date(scheduledAt).getTime();
}

export function showRate(attended: number, kept: number): number | null {
  if (kept <= 0) return null;
  return attended / kept;
}

export function ingestLagSeconds(calendlyCreatedAt: string | null | undefined, insertedAt: Date): number | null {
  if (!calendlyCreatedAt) return null;
  const created = new Date(calendlyCreatedAt).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.round((insertedAt.getTime() - created) / 1000));
}
