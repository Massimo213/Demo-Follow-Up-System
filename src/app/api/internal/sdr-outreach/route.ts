/**
 * POST /api/internal/sdr-outreach
 * Sends one SDR recruiting test / production email via Gmail SMTP.
 *
 * Auth: Bearer DEMO_ORGANIZER_SECRET (same as organizer API) or valid organizer session cookie.
 *
 * Body: { "to"?: string } — defaults to elystrateam@gmail.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { isOrganizerRequest } from '@/lib/organizer-auth';
import { sendSdrOutreachEmail } from '@/lib/sdr-outreach-mail';

export async function POST(request: NextRequest) {
  if (!(await isOrganizerRequest(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { to?: unknown } = {};
  try {
    body = (await request.json()) as { to?: unknown };
  } catch {
    /* empty body */
  }

  const rawTo = body.to;
  const to =
    typeof rawTo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawTo.trim())
      ? rawTo.trim()
      : 'elystrateam@gmail.com';

  try {
    const { messageId } = await sendSdrOutreachEmail(to);
    return NextResponse.json({
      status: 'sent',
      to,
      subject: 'SDR B2B SaaS role - conversation this week',
      messageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sdr-outreach]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
