import type { Demo } from '@/types/demo';

/** Internal / QA emails that must not pollute show-rate analytics. */
const INTERNAL_EMAIL_PATTERNS = [
  /testprospect/i,
  /elystrahelpmeteam@gmail\.com/i,
  /@elystra\.online$/i,
];

/**
 * Rows excluded from analytics cohorts (test bookings, internal QA, script inserts).
 * Does NOT change terminal status — only measurement denominators.
 */
export function isExcludedFromAnalytics(
  d: Pick<Demo, 'calendly_event_id' | 'email' | 'ingest_path'>
): boolean {
  if (d.calendly_event_id.startsWith('test-')) return true;
  if (d.ingest_path === 'test') return true;
  const email = d.email.trim().toLowerCase();
  return INTERNAL_EMAIL_PATTERNS.some((re) => re.test(email));
}
