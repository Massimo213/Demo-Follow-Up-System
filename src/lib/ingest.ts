import { toE164 } from '@/lib/phone';
import { computeHorizonHours, ingestLagSeconds } from '@/lib/phase0-rules';
import type { IngestPath } from '@/types/demo';

export type CalendlyTracking = {
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
};

export function calendlyLeadSource(
  tracking?: CalendlyTracking | null
): string | null {
  const source = tracking?.utm_source?.trim() || tracking?.utm_campaign?.trim() || '';
  return source || null;
}

export function stampIngest(opts: {
  scheduledAt: Date;
  insertedAt: Date;
  path: IngestPath;
  rawPhone: string | null;
  calendlyCreatedAt?: string | null;
  tracking?: CalendlyTracking | null;
}) {
  return {
    phone: opts.rawPhone,
    phone_e164: toE164(opts.rawPhone),
    phone_valid: true as const,
    horizon_hours: computeHorizonHours(opts.scheduledAt, opts.insertedAt),
    ingest_path: opts.path,
    ingest_lag_seconds: ingestLagSeconds(opts.calendlyCreatedAt ?? null, opts.insertedAt),
    lead_source: calendlyLeadSource(opts.tracking),
  };
}
