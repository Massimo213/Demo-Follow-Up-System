import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isOrganizerRequest } from '@/lib/organizer-auth';
import { db, type DemoOrganizerPatch } from '@/lib/db';

const BodySchema = z.object({
  organizer_booked_by: z.string().max(500).optional(),
  organizer_personal_notes: z.string().max(20000).optional(),
  pqad_verdict: z.enum(['pending', 'yes', 'no']).optional(),
  pqad_rejection_reason: z.string().max(2000).nullable().optional(),
  sdr_payout_cents: z.number().int().min(0).nullable().optional(),
  lieutenant_override_cents: z.number().int().min(0).nullable().optional(),
});

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isOrganizerRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const demo = await db.demos.findById(id);
  if (!demo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const b = parsed.data;

  const touchesLockedFields =
    b.organizer_booked_by !== undefined ||
    b.pqad_verdict !== undefined ||
    b.pqad_rejection_reason !== undefined ||
    b.sdr_payout_cents !== undefined ||
    b.lieutenant_override_cents !== undefined;

  if (demo.pqad_locked && touchesLockedFields) {
    return NextResponse.json(
      { error: 'Row locked — PQAD decision is final' },
      { status: 409 }
    );
  }

  const patch: DemoOrganizerPatch = {};

  if (b.organizer_personal_notes !== undefined) {
    patch.organizer_personal_notes = b.organizer_personal_notes;
  }

  if (b.organizer_booked_by !== undefined) {
    patch.organizer_booked_by = b.organizer_booked_by.trim();
  }
  if (b.sdr_payout_cents !== undefined) {
    patch.sdr_payout_cents = b.sdr_payout_cents;
  }
  if (b.lieutenant_override_cents !== undefined) {
    patch.lieutenant_override_cents = b.lieutenant_override_cents;
  }

  if (b.pqad_verdict === 'yes') {
    patch.pqad_verdict = 'yes';
    patch.pqad_locked = true;
    patch.pqad_rejection_reason = null;
    patch.pqad_decided_at = new Date().toISOString();
  } else if (b.pqad_verdict === 'no') {
    const reason = (b.pqad_rejection_reason ?? '').trim();
    if (!reason) {
      return NextResponse.json(
        { error: 'pqad_rejection_reason required when verdict is no' },
        { status: 400 }
      );
    }
    patch.pqad_verdict = 'no';
    patch.pqad_locked = true;
    patch.pqad_rejection_reason = reason;
    patch.pqad_decided_at = new Date().toISOString();
    patch.sdr_payout_cents = null;
    patch.lieutenant_override_cents = b.lieutenant_override_cents ?? null;
  } else if (b.pqad_verdict === 'pending') {
    patch.pqad_verdict = 'pending';
    if (b.pqad_rejection_reason !== undefined) {
      patch.pqad_rejection_reason = b.pqad_rejection_reason;
    }
  } else if (b.pqad_rejection_reason !== undefined) {
    patch.pqad_rejection_reason = b.pqad_rejection_reason;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ demo, noop: true });
  }

  const updated = await db.demos.updateOrganizerFields(demo.id, patch);
  return NextResponse.json({ demo: updated });
}
